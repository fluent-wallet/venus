import 'reflect-metadata';
import { InMemoryEventBus } from '@core/modules/eventBus/EventBus';
import type { CoreEventMap } from '@core/modules/eventBus/eventMap';
import type { RuntimeScheduler } from '@core/runtime/types';
import type { AccountService } from '@core/services/account';
import type { NetworkService } from '@core/services/network';
import type { IChainProvider } from '@core/types';
import { NetworkType } from '@core/types';
import { TxSyncScheduler } from './TxSyncScheduler';
import type { TxSyncService } from './TxSyncService';

const createSchedulerStub = () => {
  type TimeoutEntry = { handler: () => void; runAtMs: number };
  type IntervalEntry = { handler: () => void; runAtMs: number; intervalMs: number };

  let nowMs = 0;
  let nextId = 1;
  const timeouts = new Map<number, TimeoutEntry>();
  const intervals = new Map<number, IntervalEntry>();

  const scheduler: RuntimeScheduler = {
    setTimeout: (handler, timeoutMs) => {
      const id = nextId++;
      timeouts.set(id, { handler, runAtMs: nowMs + timeoutMs });
      return id as unknown as ReturnType<RuntimeScheduler['setTimeout']>;
    },
    clearTimeout: (id) => {
      timeouts.delete(id as unknown as number);
    },
    setInterval: (handler, intervalMs) => {
      const id = nextId++;
      intervals.set(id, { handler, runAtMs: nowMs + intervalMs, intervalMs });
      return id as unknown as ReturnType<RuntimeScheduler['setInterval']>;
    },
    clearInterval: (id) => {
      intervals.delete(id as unknown as number);
    },
  };

  const runUntil = (targetMs: number) => {
    while (true) {
      let nextTimeout: { id: number; entry: TimeoutEntry } | null = null;
      for (const [id, entry] of timeouts.entries()) {
        if (entry.runAtMs > targetMs) continue;
        if (!nextTimeout || entry.runAtMs < nextTimeout.entry.runAtMs) {
          nextTimeout = { id, entry };
        }
      }

      let nextInterval: { id: number; entry: IntervalEntry } | null = null;
      for (const [id, entry] of intervals.entries()) {
        if (entry.runAtMs > targetMs) continue;
        if (!nextInterval || entry.runAtMs < nextInterval.entry.runAtMs) {
          nextInterval = { id, entry };
        }
      }

      const next =
        !nextTimeout || (nextInterval && nextInterval.entry.runAtMs < nextTimeout.entry.runAtMs)
          ? nextInterval
            ? { kind: 'interval' as const, id: nextInterval.id, runAtMs: nextInterval.entry.runAtMs, handler: nextInterval.entry.handler }
            : null
          : { kind: 'timeout' as const, id: nextTimeout.id, runAtMs: nextTimeout.entry.runAtMs, handler: nextTimeout.entry.handler };

      if (!next) break;

      nowMs = next.runAtMs;

      if (next.kind === 'timeout') {
        timeouts.delete(next.id);
      } else {
        const current = intervals.get(next.id);
        if (!current) continue;
        current.runAtMs += current.intervalMs;
      }

      next.handler();
    }

    nowMs = targetMs;
  };

  const flushTimeouts = () => runUntil(nowMs);
  const advanceBy = (ms: number) => runUntil(nowMs + ms);

  return {
    scheduler,
    flushTimeouts,
    advanceBy,
    now: () => nowMs,
    getCounts: () => ({ timeoutCount: timeouts.size, intervalCount: intervals.size }),
  };
};

const waitForAsyncTurn = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

const drainImmediateWork = async (flushTimeouts: () => void) => {
  await waitForAsyncTurn();
  flushTimeouts();
  await waitForAsyncTurn();
  flushTimeouts();
  await waitForAsyncTurn();
};

const idleRefreshResult = {
  nextPollKind: 'idle' as const,
  hasHighPriorityWork: false,
  hasBackgroundWork: false,
  processedFamilyCount: 0,
  updatedTxIds: [],
};

describe('TxSyncScheduler', () => {
  it('stop() cleans interval + subscriptions (no more scans / event triggers)', async () => {
    const { scheduler, flushTimeouts, advanceBy, now, getCounts } = createSchedulerStub();

    const eventBus = new InMemoryEventBus<CoreEventMap>({ assertSerializable: false });

    const scanActiveKeysMock = jest.fn(async () => []);
    const refreshKeyMock = jest.fn(async () => idleRefreshResult);
    const txSyncService: Pick<TxSyncService, 'scanActiveKeys' | 'refreshKey'> = {
      scanActiveKeys: scanActiveKeysMock as unknown as TxSyncService['scanActiveKeys'],
      refreshKey: refreshKeyMock as unknown as TxSyncService['refreshKey'],
    };

    const accountService: Pick<AccountService, 'getCurrentAccount'> = {
      getCurrentAccount: jest.fn(async () => ({ currentAddressId: 'addr1' })) as unknown as AccountService['getCurrentAccount'],
    };

    const networkService: Pick<NetworkService, 'getCurrentNetwork'> = {
      getCurrentNetwork: jest.fn(async () => ({ id: 'net1' })) as unknown as NetworkService['getCurrentNetwork'],
    };

    const getProvider = jest.fn(async (): Promise<IChainProvider> => {
      return { chainId: '1', networkType: NetworkType.Ethereum, rpc: { request: jest.fn(), batch: jest.fn() } } as unknown as IChainProvider;
    });

    const schedulerInstance = new TxSyncScheduler({
      eventBus,
      accountService,
      networkService,
      txSyncService,
      getProvider,
      scheduler,
      now,
      logger: undefined,
      globalConcurrency: 4,
      highPriorityPollIntervalMs: 10_000,
      backgroundPollIntervalMs: 60_000,
      scanIntervalMs: 60_000,
    });

    schedulerInstance.start();
    await drainImmediateWork(flushTimeouts);

    advanceBy(60_000);
    expect(scanActiveKeysMock).toHaveBeenCalledTimes(1);

    schedulerInstance.stop();
    expect(getCounts().intervalCount).toBe(0);

    advanceBy(60_000);
    expect(scanActiveKeysMock).toHaveBeenCalledTimes(1);

    eventBus.emit('account/current-changed', {
      account: { currentAddressId: 'addr2' } as unknown as CoreEventMap['account/current-changed']['account'],
    });
    eventBus.emit('network/current-changed', {
      network: { id: 'net2' } as unknown as CoreEventMap['network/current-changed']['network'],
    });
    flushTimeouts();

    const callsAfterStop = refreshKeyMock.mock.calls.length;
    advanceBy(60_000);
    expect(refreshKeyMock).toHaveBeenCalledTimes(callsAfterStop);
  });

  it('network change recomputes high key using account.currentAddressId for selected network', async () => {
    const { scheduler, flushTimeouts, now } = createSchedulerStub();

    const eventBus = new InMemoryEventBus<CoreEventMap>({ assertSerializable: false });

    const scanActiveKeysMock = jest.fn(async () => []);
    const refreshKeyMock = jest.fn(async () => idleRefreshResult);
    const txSyncService: Pick<TxSyncService, 'scanActiveKeys' | 'refreshKey'> = {
      scanActiveKeys: scanActiveKeysMock as unknown as TxSyncService['scanActiveKeys'],
      refreshKey: refreshKeyMock as unknown as TxSyncService['refreshKey'],
    };

    let currentAddressId = 'addr1';
    const accountService: Pick<AccountService, 'getCurrentAccount'> = {
      getCurrentAccount: jest.fn(async () => ({ currentAddressId })) as unknown as AccountService['getCurrentAccount'],
    };

    const networkService: Pick<NetworkService, 'getCurrentNetwork'> = {
      getCurrentNetwork: jest.fn(async () => ({ id: 'net1' })) as unknown as NetworkService['getCurrentNetwork'],
    };

    const provider: IChainProvider = {
      chainId: '1',
      networkType: NetworkType.Ethereum,
      rpc: { request: jest.fn(), batch: jest.fn() },
      batchCall: jest.fn(),
    } as unknown as IChainProvider;
    const getProvider = jest.fn(async (): Promise<IChainProvider> => provider);

    const schedulerInstance = new TxSyncScheduler({
      eventBus,
      accountService,
      networkService,
      txSyncService,
      getProvider,
      scheduler,
      now,
      logger: undefined,
      globalConcurrency: 4,
      highPriorityPollIntervalMs: 10_000,
      backgroundPollIntervalMs: 60_000,
      scanIntervalMs: 60_000,
    });

    schedulerInstance.start();
    await drainImmediateWork(flushTimeouts);

    expect(refreshKeyMock).toHaveBeenCalledWith(expect.objectContaining({ addressId: 'addr1', networkId: 'net1' }));

    currentAddressId = 'addr2';
    eventBus.emit('network/current-changed', {
      network: { id: 'net2' } as unknown as CoreEventMap['network/current-changed']['network'],
    });

    await drainImmediateWork(flushTimeouts);

    expect(refreshKeyMock).toHaveBeenCalledWith(expect.objectContaining({ addressId: 'addr2', networkId: 'net2' }));
  });

  it('uses background cadence when only finality tracking remains for the high key', async () => {
    const { scheduler, flushTimeouts, advanceBy, now } = createSchedulerStub();

    const eventBus = new InMemoryEventBus<CoreEventMap>({ assertSerializable: false });

    const scanActiveKeysMock = jest.fn(async () => []);
    const refreshKeyMock = jest.fn(async () => ({
      nextPollKind: 'background' as const,
      hasHighPriorityWork: false,
      hasBackgroundWork: true,
      processedFamilyCount: 1,
      updatedTxIds: [],
    }));
    const txSyncService: Pick<TxSyncService, 'scanActiveKeys' | 'refreshKey'> = {
      scanActiveKeys: scanActiveKeysMock as unknown as TxSyncService['scanActiveKeys'],
      refreshKey: refreshKeyMock as unknown as TxSyncService['refreshKey'],
    };

    const accountService: Pick<AccountService, 'getCurrentAccount'> = {
      getCurrentAccount: jest.fn(async () => ({ currentAddressId: 'addr1' })) as unknown as AccountService['getCurrentAccount'],
    };

    const networkService: Pick<NetworkService, 'getCurrentNetwork'> = {
      getCurrentNetwork: jest.fn(async () => ({ id: 'net1' })) as unknown as NetworkService['getCurrentNetwork'],
    };

    const provider: IChainProvider = {
      chainId: '1',
      networkType: NetworkType.Ethereum,
      rpc: { request: jest.fn(), batch: jest.fn() },
      batchCall: jest.fn(),
    } as unknown as IChainProvider;
    const getProvider = jest.fn(async (): Promise<IChainProvider> => provider);

    const schedulerInstance = new TxSyncScheduler({
      eventBus,
      accountService,
      networkService,
      txSyncService,
      getProvider,
      scheduler,
      now,
      logger: undefined,
      globalConcurrency: 4,
      highPriorityPollIntervalMs: 10_000,
      backgroundPollIntervalMs: 60_000,
      scanIntervalMs: 60_000,
    });

    schedulerInstance.start();
    await drainImmediateWork(flushTimeouts);

    expect(refreshKeyMock).toHaveBeenCalledTimes(1);

    advanceBy(9_999);
    await drainImmediateWork(flushTimeouts);
    expect(refreshKeyMock).toHaveBeenCalledTimes(1);

    advanceBy(50_001);
    await drainImmediateWork(flushTimeouts);
    expect(refreshKeyMock).toHaveBeenCalledTimes(2);
  });
});
