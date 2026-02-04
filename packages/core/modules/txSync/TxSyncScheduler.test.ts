import 'reflect-metadata';
import { InMemoryEventBus } from '@core/modules/eventBus/EventBus';
import type { CoreEventMap } from '@core/modules/eventBus/eventMap';
import type { RuntimeScheduler } from '@core/runtime/types';
import type { IChainProvider } from '@core/types';
import { NetworkType } from '@core/types';
import { TxSyncScheduler } from './TxSyncScheduler';

const createSchedulerStub = () => {
  const timeouts = new Map<number, () => void>();
  const intervals = new Map<number, () => void>();
  let nextId = 1;

  const scheduler: RuntimeScheduler = {
    setTimeout: (handler) => {
      const id = nextId++;
      timeouts.set(id, handler);
      return id as any;
    },
    clearTimeout: (id) => {
      timeouts.delete(id as any);
    },
    setInterval: (handler) => {
      const id = nextId++;
      intervals.set(id, handler);
      return id as any;
    },
    clearInterval: (id) => {
      intervals.delete(id as any);
    },
  };

  const flushTimeouts = () => {
    const pending = Array.from(timeouts.values());
    timeouts.clear();
    pending.forEach((h) => h());
  };

  const tickIntervals = () => Array.from(intervals.values()).forEach((h) => h());

  return { scheduler, flushTimeouts, tickIntervals };
};

describe('TxSyncScheduler', () => {
  it('stop() cleans interval + subscriptions (no more scans / event triggers)', async () => {
    const { scheduler, flushTimeouts, tickIntervals } = createSchedulerStub();

    const eventBus = new InMemoryEventBus<CoreEventMap>({ assertSerializable: false });

    const scanActiveKeys = jest.fn(async () => []);
    const refreshKey = jest.fn(async () => {});

    const txSyncService: any = { scanActiveKeys, refreshKey };

    const accountService: any = {
      getCurrentAccount: jest.fn(async () => ({ currentAddressId: 'addr1' })),
    };

    const networkService: any = {
      getCurrentNetwork: jest.fn(async () => ({ id: 'net1' })),
    };

    const getProvider = jest.fn(async (): Promise<IChainProvider> => {
      return { chainId: '1', networkType: NetworkType.Ethereum, rpc: { request: jest.fn(), batch: jest.fn() } } as any;
    });

    const schedulerInstance = new TxSyncScheduler({
      eventBus,
      accountService,
      networkService,
      txSyncService,
      getProvider,
      scheduler,
      now: () => 0,
      logger: undefined,
      globalConcurrency: 4,
      highPriorityPollIntervalMs: 10_000,
      backgroundPollIntervalMs: 60_000,
      scanIntervalMs: 60_000,
    });

    schedulerInstance.start();

    // Run queued microtasks (pump)
    flushTimeouts();

    // Scan should run when interval ticks
    tickIntervals();
    expect(scanActiveKeys).toHaveBeenCalledTimes(1);

    schedulerInstance.stop();

    // After stop, ticking intervals should not call scan
    tickIntervals();
    expect(scanActiveKeys).toHaveBeenCalledTimes(1);

    // After stop, emitting events should not trigger recompute/poll
    eventBus.emit('account/current-changed', { account: { currentAddressId: 'addr2' } as any });
    eventBus.emit('network/current-changed', { network: { id: 'net2' } as any });

    flushTimeouts();

    // refreshKey may have been called during start; we only assert no extra calls post-stop.
    const callsAfterStop = refreshKey.mock.calls.length;
    flushTimeouts();
    tickIntervals();
    expect(refreshKey).toHaveBeenCalledTimes(callsAfterStop);
  });

  it('network change recomputes high key using account.currentAddressId for selected network', async () => {
    const { scheduler, flushTimeouts } = createSchedulerStub();

    const eventBus = new InMemoryEventBus<CoreEventMap>({ assertSerializable: false });

    const scanActiveKeys = jest.fn(async () => []);
    const refreshKey = jest.fn(async () => {});
    const txSyncService: any = { scanActiveKeys, refreshKey };

    let currentAddressId = 'addr1';
    const accountService: any = {
      getCurrentAccount: jest.fn(async () => ({ currentAddressId })),
    };

    const networkService: any = {
      getCurrentNetwork: jest.fn(async () => ({ id: 'net1' })),
    };

    const provider: IChainProvider = { chainId: '1', networkType: NetworkType.Ethereum, rpc: { request: jest.fn(), batch: jest.fn() } } as any;
    const getProvider = jest.fn(async (): Promise<IChainProvider> => provider);

    const schedulerInstance = new TxSyncScheduler({
      eventBus,
      accountService,
      networkService,
      txSyncService,
      getProvider,
      scheduler,
      now: () => 0,
      logger: undefined,
      globalConcurrency: 4,
      highPriorityPollIntervalMs: 10_000,
      backgroundPollIntervalMs: 60_000,
      scanIntervalMs: 60_000,
    });

    schedulerInstance.start();

    // Let initHighKeyFromServices() resolve and schedule pump.
    await new Promise<void>((r) => setImmediate(r));
    flushTimeouts();
    await new Promise<void>((r) => setImmediate(r));

    expect(refreshKey).toHaveBeenCalledWith(expect.objectContaining({ addressId: 'addr1', networkId: 'net1' }));

    // Network switched => currentAddressId should be refreshed from AccountService.
    currentAddressId = 'addr2';
    eventBus.emit('network/current-changed', { network: { id: 'net2' } as any });

    await new Promise<void>((r) => setImmediate(r));
    flushTimeouts();
    await new Promise<void>((r) => setImmediate(r));

    expect(refreshKey).toHaveBeenCalledWith(expect.objectContaining({ addressId: 'addr2', networkId: 'net2' }));
  });
});
