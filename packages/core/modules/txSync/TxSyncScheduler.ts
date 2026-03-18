import type { Logger, RuntimeScheduler } from '@core/runtime/types';
import type { AccountService } from '@core/services/account';
import type { NetworkService } from '@core/services/network';
import type { IChainProvider } from '@core/types';
import type { CoreEventMap, EventBus, Subscription } from '../eventBus';
import type { TxSyncPollKind, TxSyncRefreshResult, TxSyncService } from './TxSyncService';

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
type ScheduledPollKind = Exclude<TxSyncPollKind, 'idle'>;
type ReadyCandidate = {
  key: TxSyncKey;
  kind: KeyKind;
  nextAtMs: number;
  nextPollKind: ScheduledPollKind;
  highEpoch?: number;
};

const IDLE_NEXT_AT_MS = Number.POSITIVE_INFINITY;

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
  private wakeTimeoutId: ReturnType<RuntimeScheduler['setTimeout']> | null = null;
  private wakeDueAtMs: number | null = null;

  private readonly highKey = { value: null as TxSyncKey | null, nextAtMs: IDLE_NEXT_AT_MS, nextPollKind: 'high' as ScheduledPollKind };
  private currentAddressId: string | null = null;
  private currentNetworkId: string | null = null;
  private highEpoch = 0;
  private readonly background = new Map<string, { key: TxSyncKey; nextAtMs: number; nextPollKind: ScheduledPollKind }>();

  private readonly inFlightKeys = new Set<string>();
  private activeCount = 0;

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
        if (this.isSameKey(this.highKey.value, payload.key)) {
          this.highKey.nextPollKind = 'high';
          this.scheduleImmediate(payload.key, 'high');
        } else {
          const background = this.ensureBackgroundKey(payload.key, 'high');
          if (background) {
            background.nextPollKind = 'high';
          }
          this.scheduleImmediate(payload.key, 'background');
        }
        this.requestImmediatePump();
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

    if (this.wakeTimeoutId !== null) {
      this.scheduler.clearTimeout(this.wakeTimeoutId);
      this.wakeTimeoutId = null;
      this.wakeDueAtMs = null;
    }

    this.background.clear();
    this.highKey.value = null;
    this.highKey.nextAtMs = IDLE_NEXT_AT_MS;
    this.highKey.nextPollKind = 'high';
    this.currentAddressId = null;
    this.currentNetworkId = null;
    this.inFlightKeys.clear();
    this.activeCount = 0;
  }

  private keyId(key: TxSyncKey): string {
    return `${key.addressId}:${key.networkId}`;
  }

  private isSameKey(left: TxSyncKey | null | undefined, right: TxSyncKey | null | undefined): boolean {
    if (!left || !right) return false;
    return this.keyId(left) === this.keyId(right);
  }

  private isMoreUrgentPollKind(nextPollKind: ScheduledPollKind, currentPollKind: ScheduledPollKind): boolean {
    return nextPollKind === 'high' && currentPollKind !== 'high';
  }

  private compareReadyCandidates(left: ReadyCandidate, right: ReadyCandidate): number {
    const leftPollPriority = left.nextPollKind === 'high' ? 0 : 1;
    const rightPollPriority = right.nextPollKind === 'high' ? 0 : 1;
    if (leftPollPriority !== rightPollPriority) return leftPollPriority - rightPollPriority;

    if (left.nextAtMs !== right.nextAtMs) return left.nextAtMs - right.nextAtMs;

    const leftSlotPriority = left.kind === 'high' ? 0 : 1;
    const rightSlotPriority = right.kind === 'high' ? 0 : 1;
    return leftSlotPriority - rightSlotPriority;
  }

  private upsertBackgroundKey(
    key: TxSyncKey,
    nextPollKind: ScheduledPollKind,
    nextAtMs = this.now(),
  ): { created: boolean; entry: { key: TxSyncKey; nextAtMs: number; nextPollKind: ScheduledPollKind } } | null {
    if (this.isSameKey(this.highKey.value, key)) return null;

    const id = this.keyId(key);
    const entry = this.background.get(id);

    if (entry) {
      return { created: false, entry };
    }

    const createdEntry = { key, nextAtMs, nextPollKind };
    this.background.set(id, createdEntry);
    return { created: true, entry: createdEntry };
  }

  private ensureBackgroundKey(
    key: TxSyncKey,
    nextPollKind: ScheduledPollKind = 'background',
  ): { key: TxSyncKey; nextAtMs: number; nextPollKind: ScheduledPollKind } | null {
    return this.upsertBackgroundKey(key, nextPollKind)?.entry ?? null;
  }

  private moveHighKeyToBackground(key: TxSyncKey): void {
    const previousNextAtMs = this.highKey.nextAtMs;
    const previousNextPollKind = this.highKey.nextPollKind;
    const background = this.upsertBackgroundKey(key, previousNextPollKind, previousNextAtMs);

    if (!background || background.created) return;

    background.entry.nextAtMs = Math.min(background.entry.nextAtMs, previousNextAtMs);
    if (this.isMoreUrgentPollKind(previousNextPollKind, background.entry.nextPollKind)) {
      background.entry.nextPollKind = previousNextPollKind;
    }
  }

  private promoteHighKeyIfNeeded(nextPollKind: ScheduledPollKind): boolean {
    if (!this.highKey.value) return false;

    if (!Number.isFinite(this.highKey.nextAtMs)) {
      this.highKey.nextPollKind = nextPollKind;
      this.highKey.nextAtMs = this.now();
      return true;
    }

    if (!this.isMoreUrgentPollKind(nextPollKind, this.highKey.nextPollKind)) {
      return false;
    }

    this.highKey.nextPollKind = nextPollKind;
    this.highKey.nextAtMs = Math.min(this.highKey.nextAtMs, this.now());
    return true;
  }

  private async initHighKeyFromServices(gen: number): Promise<void> {
    try {
      const [account, network] = await Promise.all([this.accountService.getCurrentAccount(), this.networkService.getCurrentNetwork()]);

      if (!this.started || gen !== this.runGeneration) return;

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

      this.currentAddressId = null;
    } finally {
      const shouldRecompute = this.started && params.gen === this.runGeneration && this.currentNetworkId === params.expectedNetworkId;

      if (shouldRecompute) {
        this.recomputeHighKeyAndPoll(params.reason);
      }
    }
  }

  private recomputeHighKeyAndPoll(reason: string): void {
    if (!this.started) return;

    const previousHigh = this.highKey.value;

    if (!this.currentAddressId || !this.currentNetworkId) {
      if (previousHigh) this.moveHighKeyToBackground(previousHigh);

      this.highEpoch += 1;
      this.highKey.value = null;
      this.highKey.nextAtMs = IDLE_NEXT_AT_MS;
      this.highKey.nextPollKind = 'high';
      this.logger?.debug('TxSyncScheduler:high-key-cleared', { reason, highEpoch: this.highEpoch });

      this.requestImmediatePump();
      return;
    }

    const key: TxSyncKey = { addressId: this.currentAddressId, networkId: this.currentNetworkId };
    if (previousHigh && !this.isSameKey(previousHigh, key)) {
      this.moveHighKeyToBackground(previousHigh);
    }

    this.highEpoch += 1;
    this.highKey.value = key;
    this.highKey.nextAtMs = this.now();
    this.highKey.nextPollKind = 'high';
    this.background.delete(this.keyId(key));

    this.logger?.debug('TxSyncScheduler:high-key', { reason, key, highEpoch: this.highEpoch });
    this.requestImmediatePump();
  }

  private scheduleImmediate(key: TxSyncKey, kind: KeyKind): void {
    const now = this.now();

    if (kind === 'high') {
      if (this.isSameKey(this.highKey.value, key)) {
        this.highKey.nextAtMs = now;
      }
      return;
    }

    if (this.isSameKey(this.highKey.value, key)) {
      this.highKey.nextAtMs = now;
      return;
    }

    const id = this.keyId(key);
    const entry = this.background.get(id);
    if (!entry) {
      this.background.set(id, { key, nextAtMs: now, nextPollKind: 'background' });
      return;
    }

    entry.nextAtMs = now;
  }

  private async scanDbAndReconcile(): Promise<void> {
    if (!this.started) return;

    const keys = await this.txSyncService.scanActiveKeys();
    const seen = new Set<string>();
    let shouldRequestPump = false;

    for (const entry of keys) {
      const id = this.keyId(entry.key);
      seen.add(id);

      if (this.isSameKey(this.highKey.value, entry.key)) {
        if (this.promoteHighKeyIfNeeded(entry.nextPollKind)) {
          shouldRequestPump = true;
        }
        continue;
      }

      const background = this.upsertBackgroundKey(entry.key, entry.nextPollKind);
      if (!background) continue;

      if (background.created) {
        shouldRequestPump = true;
        continue;
      }

      // Reconcile only missing work or urgency promotions; keep the existing cadence otherwise.
      if (this.isMoreUrgentPollKind(entry.nextPollKind, background.entry.nextPollKind)) {
        background.entry.nextPollKind = entry.nextPollKind;
        background.entry.nextAtMs = Math.min(background.entry.nextAtMs, this.now());
        shouldRequestPump = true;
      }
    }

    for (const [id] of Array.from(this.background.entries())) {
      if (!seen.has(id)) {
        this.background.delete(id);
      }
    }

    if (shouldRequestPump) {
      this.requestImmediatePump();
    }
  }

  private scheduleWake(delayMs: number): void {
    if (!this.started) return;

    const sanitizedDelayMs = Math.max(0, Math.floor(delayMs));
    const dueAtMs = this.now() + sanitizedDelayMs;

    if (this.wakeTimeoutId !== null && this.wakeDueAtMs !== null && this.wakeDueAtMs <= dueAtMs) {
      return;
    }

    if (this.wakeTimeoutId !== null) {
      this.scheduler.clearTimeout(this.wakeTimeoutId);
      this.wakeTimeoutId = null;
      this.wakeDueAtMs = null;
    }

    const gen = this.runGeneration;
    this.wakeDueAtMs = dueAtMs;
    this.wakeTimeoutId = this.scheduler.setTimeout(() => {
      this.wakeTimeoutId = null;
      this.wakeDueAtMs = null;

      if (!this.started || gen !== this.runGeneration) return;
      void this.runAvailable(gen);
    }, sanitizedDelayMs);
  }

  private requestImmediatePump(): void {
    this.scheduleWake(0);
  }

  private getNextDueAtMs(): number | null {
    let nextDueAtMs: number | null = null;

    const high = this.highKey.value;
    if (high) {
      const highId = this.keyId(high);
      if (!this.inFlightKeys.has(highId) && Number.isFinite(this.highKey.nextAtMs)) {
        nextDueAtMs = this.highKey.nextAtMs;
      }
    }

    for (const entry of this.background.values()) {
      if (this.isSameKey(this.highKey.value, entry.key)) continue;

      const id = this.keyId(entry.key);
      if (this.inFlightKeys.has(id)) continue;
      if (!Number.isFinite(entry.nextAtMs)) continue;

      if (nextDueAtMs === null || entry.nextAtMs < nextDueAtMs) {
        nextDueAtMs = entry.nextAtMs;
      }
    }

    return nextDueAtMs;
  }

  private schedulePumpForNextDue(): void {
    if (!this.started) return;
    if (this.activeCount >= this.globalConcurrency) return;

    const nextDueAtMs = this.getNextDueAtMs();
    if (nextDueAtMs === null) return;

    this.scheduleWake(Math.max(0, nextDueAtMs - this.now()));
  }

  private pickNextKey(): { key: TxSyncKey; kind: KeyKind; highEpoch?: number } | null {
    const now = this.now();
    let best: ReadyCandidate | null = null;

    const consider = (currentBest: ReadyCandidate | null, candidate: ReadyCandidate | null): ReadyCandidate | null => {
      if (!candidate) return currentBest;
      if (candidate.nextAtMs > now) return currentBest;
      if (!currentBest || this.compareReadyCandidates(candidate, currentBest) < 0) return candidate;
      return currentBest;
    };

    const high = this.highKey.value;
    if (high) {
      const highId = this.keyId(high);
      if (!this.inFlightKeys.has(highId) && this.highKey.nextAtMs <= now) {
        best = consider(best, {
          key: high,
          kind: 'high',
          nextAtMs: this.highKey.nextAtMs,
          nextPollKind: this.highKey.nextPollKind,
          highEpoch: this.highEpoch,
        });
      }
    }

    for (const entry of this.background.values()) {
      if (this.isSameKey(this.highKey.value, entry.key)) continue;

      const id = this.keyId(entry.key);
      if (this.inFlightKeys.has(id)) continue;
      best = consider(best, {
        key: entry.key,
        kind: 'background',
        nextAtMs: entry.nextAtMs,
        nextPollKind: entry.nextPollKind,
      });
    }

    if (best === null) return null;

    return { key: best.key, kind: best.kind, highEpoch: best.highEpoch };
  }

  private rescheduleAfterRun(key: TxSyncKey, kind: KeyKind, nextPollKind: TxSyncPollKind): void {
    const now = this.now();

    if (kind === 'high' || this.isSameKey(this.highKey.value, key)) {
      if (!this.isSameKey(this.highKey.value, key)) return;

      if (nextPollKind === 'idle') {
        this.highKey.nextAtMs = IDLE_NEXT_AT_MS;
        return;
      }

      this.highKey.nextPollKind = nextPollKind;
      const delayMs = nextPollKind === 'high' ? this.highPriorityPollIntervalMs : this.backgroundPollIntervalMs;
      this.highKey.nextAtMs = now + delayMs;
      return;
    }

    const id = this.keyId(key);
    if (nextPollKind === 'idle') {
      this.background.delete(id);
      return;
    }

    const delayMs = nextPollKind === 'high' ? this.highPriorityPollIntervalMs : this.backgroundPollIntervalMs;
    const entry = this.background.get(id);

    if (!entry) {
      this.background.set(id, { key, nextAtMs: now + delayMs, nextPollKind });
      return;
    }

    entry.nextPollKind = nextPollKind;
    entry.nextAtMs = now + delayMs;
  }

  private async runAvailable(gen: number): Promise<void> {
    while (this.started && gen === this.runGeneration && this.activeCount < this.globalConcurrency) {
      const next = this.pickNextKey();
      if (!next) break;

      const id = this.keyId(next.key);
      this.inFlightKeys.add(id);
      this.activeCount += 1;

      void this.runKeyOnce(next.key, next.kind, next.highEpoch, gen).finally(() => {
        if (!this.started) return;
        if (gen !== this.runGeneration) return;

        this.inFlightKeys.delete(id);
        this.activeCount -= 1;
        this.requestImmediatePump();
      });
    }

    this.schedulePumpForNextDue();
  }

  private async runKeyOnce(key: TxSyncKey, kind: KeyKind, highEpochAtStart: number | undefined, gen: number): Promise<void> {
    let refreshResult: TxSyncRefreshResult = {
      nextPollKind: kind === 'high' ? 'high' : 'background',
      hasHighPriorityWork: kind === 'high',
      hasBackgroundWork: kind !== 'high',
      processedFamilyCount: 0,
      updatedTxIds: [],
    };

    try {
      const provider = await this.getProvider(key);
      refreshResult = await this.txSyncService.refreshKey({ ...key, provider, maxResendCount: Number.POSITIVE_INFINITY });
    } catch (error) {
      this.logger?.warn('TxSyncScheduler:run-failed', { key, kind, error });
    } finally {
      const shouldReschedule = this.started && gen === this.runGeneration;

      if (shouldReschedule) {
        if (kind === 'high') {
          const stillHigh = this.isSameKey(this.highKey.value, key);
          const epochOk = typeof highEpochAtStart === 'number' ? highEpochAtStart === this.highEpoch : true;

          if (stillHigh && epochOk) {
            this.rescheduleAfterRun(key, kind, refreshResult.nextPollKind);
          }
        } else {
          this.rescheduleAfterRun(key, kind, refreshResult.nextPollKind);
        }
      }
    }
  }
}
