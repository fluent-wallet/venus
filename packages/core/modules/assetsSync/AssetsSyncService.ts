import type { Logger, RuntimeScheduler } from '@core/runtime/types';
import type { AssetService } from '@core/services';
import type { AccountService } from '@core/services/account';
import type { NetworkService } from '@core/services/network';
import type { CoreEventMap, EventBus } from '../eventBus';
import type { AssetsSyncErrorSnapshot, AssetsSyncKey, AssetsSyncReason } from './types';

export type AssetsSyncServiceOptions = {
  eventBus: EventBus<CoreEventMap>;
  accountService: AccountService;
  assetService: AssetService;
  networkService: NetworkService;

  scheduler: RuntimeScheduler;
  now: () => number;
  logger?: Logger;

  pollIntervalMs: number;
};

export class AssetsSyncService {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly accountService: AccountService;
  private readonly assetService: AssetService;
  private readonly networkService: NetworkService;

  private readonly scheduler: RuntimeScheduler;
  private readonly now: () => number;
  private readonly logger?: Logger;

  private readonly pollIntervalMs: number;

  private started = false;
  private pollIntervalId: ReturnType<RuntimeScheduler['setInterval']> | null = null;

  private inFlight: Promise<void> | null = null;
  private runSeq = 0;

  constructor(options: AssetsSyncServiceOptions) {
    this.eventBus = options.eventBus;
    this.accountService = options.accountService;
    this.networkService = options.networkService;
    this.assetService = options.assetService;

    this.scheduler = options.scheduler;
    this.now = options.now;
    this.logger = options.logger;

    this.pollIntervalMs = options.pollIntervalMs;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    if (this.pollIntervalMs > 0) {
      this.pollIntervalId = this.scheduler.setInterval(() => {
        void this.refreshCurrent({ reason: 'poll' });
      }, this.pollIntervalMs);
    }

    // Optional: callers can manually trigger a start refresh via refreshCurrent({ reason: 'start' })
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.pollIntervalId !== null) {
      this.scheduler.clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  async refreshCurrent(options: { reason: AssetsSyncReason } = { reason: 'manual' }): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const runId = this.makeRunId();
    const reason = options.reason;

    const run = (async () => {
      const key = await this.getCurrentKeyOrNull();
      if (!key) {
        return;
      }

      await this.runOnce({ key, reason, runId });
    })();

    this.inFlight = run;

    try {
      await run;
    } finally {
      if (this.inFlight === run) {
        this.inFlight = null;
      }
    }
  }

  private async runOnce(params: { key: AssetsSyncKey; reason: AssetsSyncReason; runId: string }): Promise<void> {
    const { key, reason, runId } = params;

    this.eventBus.emit('assets-sync/started', {
      key,
      reason,
      runId,
      timestampMs: this.now(),
    });

    try {
      const assets = await this.assetService.getAssetsByAddress(key.addressId);
      const updatedCount = assets.length;

      this.eventBus.emit('assets-sync/updated', {
        key,
        reason,
        runId,
        timestampMs: this.now(),
        updatedCount,
      });

      this.eventBus.emit('assets-sync/succeeded', {
        key,
        reason,
        runId,
        timestampMs: this.now(),
        updatedCount,
        snapshot: { assets },
      });
    } catch (error) {
      const snapshot = this.toErrorSnapshot(error);

      this.logger?.warn('AssetsSync:refresh-failed', { key, reason, runId, error: snapshot });

      this.eventBus.emit('assets-sync/failed', {
        key,
        reason,
        runId,
        timestampMs: this.now(),
        error: snapshot,
      });
    }
  }

  private async getCurrentKeyOrNull(): Promise<AssetsSyncKey | null> {
    const account = await this.accountService.getCurrentAccount();
    if (!account?.currentAddressId) {
      return null;
    }

    const network = await this.networkService.getCurrentNetwork();

    return {
      addressId: account.currentAddressId,
      networkId: network.id,
    };
  }
  private makeRunId(): string {
    this.runSeq += 1;
    return `assets_sync_${this.now().toString(36)}_${this.runSeq.toString(36)}`;
  }

  private toErrorSnapshot(error: unknown): AssetsSyncErrorSnapshot {
    if (error && typeof error === 'object') {
      const maybe = error as { code?: unknown; message?: unknown; context?: unknown };

      const code = typeof maybe.code === 'string' ? maybe.code : 'ASSETS_SYNC_FAILED';
      const message = typeof maybe.message === 'string' ? maybe.message : 'Assets sync failed.';

      const context = maybe.context && typeof maybe.context === 'object' ? (maybe.context as Record<string, unknown>) : undefined;

      return { code, message, context };
    }

    return { code: 'ASSETS_SYNC_FAILED', message: 'Assets sync failed.' };
  }
}
