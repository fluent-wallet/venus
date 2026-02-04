import { CoreError, NFT_SYNC_FETCH_FAILED, NFT_SYNC_FETCHER_NOT_CONFIGURED } from '@core/errors';
import type { Logger, RuntimeScheduler } from '@core/runtime/types';
import type { AccountService } from '@core/services/account';
import type { NetworkService } from '@core/services/network';
import type { CoreEventMap, EventBus } from '../eventBus';
import { fetchNftItemsFromConfluxScanEvmOpenApi } from './fetchers/confluxScanEvmOpenApi';
import { buildScanOpenApiKey, type FetchFunction, type NftFetcher, type NftSyncErrorSnapshot, type NftSyncKey, type NftSyncReason } from './types';

export type NftSyncServiceOptions = {
  eventBus: EventBus<CoreEventMap>;
  accountService: AccountService;
  networkService: NetworkService;

  scheduler: RuntimeScheduler;
  now: () => number;
  logger?: Logger;

  pollIntervalMs: number;
  scanOpenApiByKey: Record<string, string>;

  fetcher?: NftFetcher;
  fetchFn?: FetchFunction;
};
type AbortReason = 'stop' | 'target_changed';

type InFlightRun = {
  key: NftSyncKey;
  runId: string;
  controller: AbortController;
  abortReason: AbortReason | null;
  promise: Promise<void>;
};

export class NftSyncService {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly accountService: AccountService;
  private readonly networkService: NetworkService;

  private readonly scheduler: RuntimeScheduler;
  private readonly now: () => number;
  private readonly logger?: Logger;

  private readonly pollIntervalMs: number;
  private readonly scanOpenApiByKey: Record<string, string>;

  private readonly fetcher: NftFetcher;
  private readonly fetchFn?: FetchFunction;

  private started = false;
  private pollIntervalId: ReturnType<RuntimeScheduler['setInterval']> | null = null;

  private currentContractAddress: string | null = null;

  private inFlight: InFlightRun | null = null;
  private runSequence = 0;

  constructor(options: NftSyncServiceOptions) {
    this.eventBus = options.eventBus;
    this.accountService = options.accountService;
    this.networkService = options.networkService;

    this.scheduler = options.scheduler;
    this.now = options.now;
    this.logger = options.logger;

    this.pollIntervalMs = options.pollIntervalMs;
    this.scanOpenApiByKey = options.scanOpenApiByKey;

    this.fetcher = options.fetcher ?? fetchNftItemsFromConfluxScanEvmOpenApi;
    this.fetchFn = options.fetchFn;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    if (this.pollIntervalMs > 0) {
      this.pollIntervalId = this.scheduler.setInterval(() => {
        void this.refreshCurrent({ reason: 'poll' });
      }, this.pollIntervalMs);
    }
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.pollIntervalId !== null) {
      this.scheduler.clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    this.abortInFlight('stop');
  }

  setCurrentTarget(target: { contractAddress: string } | null): void {
    const next = target?.contractAddress ? target.contractAddress.trim().toLowerCase() : null;
    if (next === this.currentContractAddress) return;

    this.currentContractAddress = next;
    this.abortInFlight('target_changed');
  }

  async refreshCurrent(options: { reason: NftSyncReason } = { reason: 'manual' }): Promise<void> {
    const key = await this.getCurrentKeyOrNull();
    if (!key) return;

    if (this.inFlight && this.isSameKey(this.inFlight.key, key)) {
      return this.inFlight.promise;
    }

    if (this.inFlight && !this.isSameKey(this.inFlight.key, key)) {
      this.abortInFlight('target_changed');
    }

    const runId = this.makeRunId();
    const controller = new AbortController();

    const run: InFlightRun = {
      key,
      runId,
      controller,
      abortReason: null,
      promise: Promise.resolve(),
    };

    const promise = this.runOnce({ key, runId, reason: options.reason, controller, getAbortReason: () => run.abortReason });
    run.promise = promise;

    this.inFlight = run;

    try {
      await promise;
    } finally {
      if (this.inFlight?.runId === runId) {
        this.inFlight = null;
      }
    }
  }

  private async runOnce(params: {
    key: NftSyncKey;
    runId: string;
    reason: NftSyncReason;
    controller: AbortController;
    getAbortReason: () => AbortReason | null;
  }): Promise<void> {
    const { key, runId, reason, controller, getAbortReason } = params;

    this.eventBus.emit('nft-sync/started', { key, reason, runId, timestampMs: this.now() });

    try {
      const account = await this.accountService.getCurrentAccount();
      if (!account) {
        return;
      }

      const network = await this.networkService.getCurrentNetwork();
      const configKey = buildScanOpenApiKey({ networkType: network.networkType, chainId: network.chainId });

      const baseUrl = this.scanOpenApiByKey[configKey];
      if (!baseUrl) {
        throw new CoreError({
          code: NFT_SYNC_FETCHER_NOT_CONFIGURED,
          message: 'Scan OpenAPI baseUrl is not configured for current network.',
          context: { configKey },
        });
      }

      const items = await this.fetcher({
        baseUrl,
        ownerAddress: account.address,
        contractAddress: key.contractAddress,
        signal: controller.signal,
        fetchFn: this.fetchFn,
      });

      if (this.inFlight?.runId !== runId) {
        return;
      }

      const updatedCount = items.length;

      this.eventBus.emit('nft-sync/updated', { key, reason, runId, timestampMs: this.now(), updatedCount });

      this.eventBus.emit('nft-sync/succeeded', {
        key,
        reason,
        runId,
        timestampMs: this.now(),
        updatedCount,
        snapshot: { contractAddress: key.contractAddress, items },
      });
    } catch (error) {
      if (this.inFlight?.runId !== runId) {
        return;
      }

      const snapshot = this.toErrorSnapshot(error, { aborted: controller.signal.aborted, abortReason: getAbortReason() });

      this.logger?.warn('NftSync:refresh-failed', { key, reason, runId, error: snapshot });

      this.eventBus.emit('nft-sync/failed', { key, reason, runId, timestampMs: this.now(), error: snapshot });
    }
  }
  private async getCurrentKeyOrNull(): Promise<NftSyncKey | null> {
    const contractAddressAtStart = this.currentContractAddress;
    if (!contractAddressAtStart) return null;

    const account = await this.accountService.getCurrentAccount();
    if (!account?.currentAddressId) return null;

    const network = await this.networkService.getCurrentNetwork();

    const contractAddressAtEnd = this.currentContractAddress;
    if (!contractAddressAtEnd || contractAddressAtEnd !== contractAddressAtStart) {
      return null;
    }

    return { addressId: account.currentAddressId, networkId: network.id, contractAddress: contractAddressAtEnd };
  }

  private abortInFlight(reason: AbortReason): void {
    if (!this.inFlight) return;

    this.inFlight.abortReason = reason;
    try {
      this.inFlight.controller.abort();
    } catch {
      // ignore
    }
  }

  private isSameKey(a: NftSyncKey, b: NftSyncKey): boolean {
    return a.addressId === b.addressId && a.networkId === b.networkId && a.contractAddress === b.contractAddress;
  }

  private makeRunId(): string {
    this.runSequence += 1;
    return `nft_sync_${this.now().toString(36)}_${this.runSequence.toString(36)}`;
  }

  private toErrorSnapshot(error: unknown, meta: { aborted: boolean; abortReason: AbortReason | null }): NftSyncErrorSnapshot {
    if (meta.aborted) {
      return {
        code: NFT_SYNC_FETCH_FAILED,
        message: 'Nft sync aborted.',
        context: { aborted: true, abortReason: meta.abortReason ?? 'unknown' },
      };
    }

    if (error && typeof error === 'object') {
      const maybe = error as { code?: unknown; message?: unknown; context?: unknown };

      const code = typeof maybe.code === 'string' ? maybe.code : NFT_SYNC_FETCH_FAILED;
      const message = typeof maybe.message === 'string' ? maybe.message : 'Nft sync failed.';

      const context = maybe.context && typeof maybe.context === 'object' ? (maybe.context as Record<string, unknown>) : undefined;

      if (context) {
        return { code, message, context };
      }
      return { code, message };
    }

    return { code: NFT_SYNC_FETCH_FAILED, message: 'Nft sync failed.' };
  }
}
