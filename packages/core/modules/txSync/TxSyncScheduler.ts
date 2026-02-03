import type { Logger, RuntimeScheduler } from '@core/runtime/types';
import type { AccountService } from '@core/services/account';
import type { NetworkService } from '@core/services/network';
import type { IChainProvider } from '@core/types';
import type { CoreEventMap, EventBus, Subscription } from '../eventBus';
import type { TxSyncService } from './TxSyncService';

export type TxSyncKey = { addressId: string; networkId: string };

export type TxSyncSchedulerOptions = {
  eventBus: EventBus<CoreEventMap>;
  accountService: AccountService;
  networkService: NetworkService;
  txSyncService: TxSyncService;

  getProvider: (key: TxSyncKey) => Promise<IChainProvider>;

  scheduler: RuntimeScheduler;
  now: () => number;
  logger?: Logger;

  globalConcurrency: number; // default 4
  highPriorityPollIntervalMs: number; // default 10s
  backgroundPollIntervalMs: number; // default 60s
  scanIntervalMs: number; // default 60s
};

type KeyKind = 'high' | 'background';

export class TxSyncScheduler {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly accountService: AccountService;
  private readonly networkService: NetworkService;
  private readonly txSyncService: TxSyncService;
  private readonly getProvider: (key: TxSyncKey) => Promise<IChainProvider>;
  private readonly scheduler: RuntimeScheduler;
  private readonly now: () => number;
  private readonly logger?: Logger;

  private readonly globalConcurrency: number;
  private readonly highPriorityPollIntervalMs: number;
  private readonly backgroundPollIntervalMs: number;
  private readonly scanIntervalMs: number;

  private started = false;
  private subs: Subscription[] = [];
  private scanIntervalId: ReturnType<RuntimeScheduler['setInterval']> | null = null;
  private pumpTimeoutId: ReturnType<RuntimeScheduler['setTimeout']> | null = null;

  private readonly highKey = { value: null as TxSyncKey | null, nextAtMs: 0 };
  private currentAddressId: string | null = null;
  private currentNetworkId: string | null = null;
  private highEpoch = 0;
  private readonly background = new Map<string, { key: TxSyncKey; nextAtMs: number }>();

  private readonly inFlightKeys = new Set<string>();
  private activeCount = 0;
  private pumpScheduled = false;

  private runGeneration = 0;

  constructor(options: TxSyncSchedulerOptions) {
    this.eventBus = options.eventBus;
    this.accountService = options.accountService;
    this.networkService = options.networkService;
    this.txSyncService = options.txSyncService;
    this.getProvider = options.getProvider;

    this.scheduler = options.scheduler;
    this.now = options.now;
    this.logger = options.logger;

    this.globalConcurrency = Math.max(1, options.globalConcurrency);
    this.highPriorityPollIntervalMs = options.highPriorityPollIntervalMs;
    this.backgroundPollIntervalMs = options.backgroundPollIntervalMs;
    this.scanIntervalMs = options.scanIntervalMs;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.runGeneration += 1;

    this.subs.push(
      this.eventBus.on('account/current-changed', (payload) => {
        this.currentAddressId = payload.account.currentAddressId;
        this.recomputeHighKeyAndPoll('account_changed');
      }),
    );

    this.subs.push(
      this.eventBus.on('network/current-changed', (payload) => {
        const networkId = payload.network.id;
        this.currentNetworkId = networkId;
        void this.refreshCurrentAddressIdForSelectedNetwork({ reason: 'network_changed', expectedNetworkId: networkId, gen: this.runGeneration });
      }),
    );

    this.subs.push(
      this.eventBus.on('tx/created', (payload) => {
        this.ensureBackgroundKey(payload.key);
        this.scheduleImmediate(payload.key, 'background');
        this.pump();
      }),
    );

    this.scanIntervalId = this.scheduler.setInterval(() => {
      void this.scanDbAndReconcile().catch((error) => {
        this.logger?.warn('TxSyncScheduler:scan-failed', { error });
      });
    }, this.scanIntervalMs);

    void this.initHighKeyFromServices(this.runGeneration);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.runGeneration += 1;
    for (const s of this.subs) s.unsubscribe();
    this.subs = [];

    if (this.scanIntervalId !== null) {
      this.scheduler.clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }

    if (this.pumpTimeoutId !== null) {
      this.scheduler.clearTimeout(this.pumpTimeoutId);
      this.pumpTimeoutId = null;
    }

    // Stop running new work; in-flight promises may still resolve, but we won't schedule more.
    this.background.clear();
    this.highKey.value = null;
    this.highKey.nextAtMs = 0;
    this.currentAddressId = null;
    this.currentNetworkId = null;
    this.inFlightKeys.clear();
    this.activeCount = 0;
    this.pumpScheduled = false;
  }
  private keyId(key: TxSyncKey): string {
    return `${key.addressId}:${key.networkId}`;
  }

  private async initHighKeyFromServices(gen: number): Promise<void> {
    try {
      const [account, network] = await Promise.all([this.accountService.getCurrentAccount(), this.networkService.getCurrentNetwork()]);

      if (!this.started || gen !== this.runGeneration) return;

      // Don't override values already set by events.
      if (!this.currentAddressId) this.currentAddressId = account?.currentAddressId ?? null;
      if (!this.currentNetworkId) this.currentNetworkId = network?.id ?? null;

      this.recomputeHighKeyAndPoll('start');
    } catch (error) {
      this.logger?.warn('TxSyncScheduler:init-high-key-failed', { error });
    }
  }

  private async refreshCurrentAddressIdForSelectedNetwork(params: { reason: string; expectedNetworkId: string; gen: number }): Promise<void> {
    try {
      const account = await this.accountService.getCurrentAccount();
      if (!this.started || params.gen !== this.runGeneration) return;
      if (this.currentNetworkId !== params.expectedNetworkId) return;

      this.currentAddressId = account?.currentAddressId ?? null;
    } catch (error) {
      this.logger?.warn('TxSyncScheduler:refresh-current-address-failed', { reason: params.reason, error });
      if (!this.started || params.gen !== this.runGeneration) return;
      if (this.currentNetworkId !== params.expectedNetworkId) return;

      // Avoid combining a stale addressId with a new networkId.
      this.currentAddressId = null;
    } finally {
      if (!this.started || params.gen !== this.runGeneration) return;
      if (this.currentNetworkId !== params.expectedNetworkId) return;
      this.recomputeHighKeyAndPoll(params.reason);
    }
  }

  private recomputeHighKeyAndPoll(reason: string): void {
    if (!this.started) return;

    if (!this.currentAddressId || !this.currentNetworkId) {
      this.highEpoch += 1;
      this.highKey.value = null;
      this.highKey.nextAtMs = 0;
      this.logger?.debug('TxSyncScheduler:high-key-cleared', { reason, highEpoch: this.highEpoch });

      this.pump();
      return;
    }

    const key: TxSyncKey = { addressId: this.currentAddressId, networkId: this.currentNetworkId };

    this.highEpoch += 1;
    this.highKey.value = key;
    this.highKey.nextAtMs = this.now();

    this.logger?.debug('TxSyncScheduler:high-key', { reason, key, highEpoch: this.highEpoch });
    this.pump();
  }
  private ensureBackgroundKey(key: TxSyncKey): void {
    const id = this.keyId(key);
    if (this.background.has(id)) return;
    this.background.set(id, { key, nextAtMs: this.now() });
  }

  private scheduleImmediate(key: TxSyncKey, kind: KeyKind): void {
    const now = this.now();

    if (kind === 'high') {
      if (this.highKey.value && this.keyId(this.highKey.value) === this.keyId(key)) {
        this.highKey.nextAtMs = now;
      }
      return;
    }

    const id = this.keyId(key);
    const entry = this.background.get(id);
    if (!entry) {
      this.background.set(id, { key, nextAtMs: now });
      return;
    }
    entry.nextAtMs = now;
  }

  private async scanDbAndReconcile(): Promise<void> {
    if (!this.started) return;

    const keys = await this.txSyncService.scanActiveKeys();

    const seen = new Set<string>();
    for (const key of keys) {
      const id = this.keyId(key);
      seen.add(id);
      this.ensureBackgroundKey(key);
    }

    for (const id of Array.from(this.background.keys())) {
      const isHigh = this.highKey.value ? id === this.keyId(this.highKey.value) : false;
      if (isHigh) continue;
      if (!seen.has(id)) this.background.delete(id);
    }

    this.pump();
  }

  private pump(): void {
    if (!this.started) return;
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;

    const gen = this.runGeneration;

    this.pumpTimeoutId = this.scheduler.setTimeout(() => {
      this.pumpTimeoutId = null;

      // Avoid leaving pumpScheduled=true when stop()->start() changes generation.
      if (!this.started || gen !== this.runGeneration) {
        this.pumpScheduled = false;
        return;
      }

      this.pumpScheduled = false;
      void this.runAvailable(gen);
    }, 0);
  }

  private pickNextKey(): { key: TxSyncKey; kind: KeyKind; highEpoch?: number } | null {
    const now = this.now();

    const high = this.highKey.value;
    if (high && this.highKey.nextAtMs <= now) {
      return { key: high, kind: 'high', highEpoch: this.highEpoch };
    }

    let best: { key: TxSyncKey; kind: KeyKind; nextAtMs: number } | null = null;
    for (const entry of this.background.values()) {
      if (entry.nextAtMs > now) continue;
      if (!best || entry.nextAtMs < best.nextAtMs) {
        best = { key: entry.key, kind: 'background', nextAtMs: entry.nextAtMs };
      }
    }
    return best ? { key: best.key, kind: best.kind } : null;
  }

  private rescheduleAfterRun(key: TxSyncKey, kind: KeyKind): void {
    const now = this.now();

    if (kind === 'high') {
      this.highKey.nextAtMs = now + this.highPriorityPollIntervalMs;
      return;
    }

    const id = this.keyId(key);
    const entry = this.background.get(id);
    if (!entry) return;
    entry.nextAtMs = now + this.backgroundPollIntervalMs;
  }

  private async runAvailable(gen: number): Promise<void> {
    while (this.started && gen === this.runGeneration && this.activeCount < this.globalConcurrency) {
      const next = this.pickNextKey();
      if (!next) return;

      const id = this.keyId(next.key);
      if (this.inFlightKeys.has(id)) {
        this.rescheduleAfterRun(next.key, next.kind);
        continue;
      }

      this.inFlightKeys.add(id);
      this.activeCount += 1;

      void this.runKeyOnce(next.key, next.kind, next.highEpoch, gen).finally(() => {
        if (!this.started) return;
        if (gen !== this.runGeneration) return;

        this.inFlightKeys.delete(id);
        this.activeCount -= 1;
        this.pump();
      });
    }
  }

  private async runKeyOnce(key: TxSyncKey, kind: KeyKind, highEpochAtStart: number | undefined, gen: number): Promise<void> {
    try {
      const provider = await this.getProvider(key);
      await this.txSyncService.refreshKey({ ...key, provider, maxResendCount: Number.POSITIVE_INFINITY });
    } catch (error) {
      this.logger?.warn('TxSyncScheduler:run-failed', { key, kind, error });
    } finally {
      if (!this.started) return;
      if (gen !== this.runGeneration) return;

      if (kind === 'high') {
        const stillHigh = this.highKey.value && this.keyId(this.highKey.value) === this.keyId(key);
        const epochOk = typeof highEpochAtStart === 'number' ? highEpochAtStart === this.highEpoch : true;

        if (stillHigh && epochOk) {
          this.rescheduleAfterRun(key, kind);
        }
        return;
      }

      this.rescheduleAfterRun(key, kind);
    }
  }
}
