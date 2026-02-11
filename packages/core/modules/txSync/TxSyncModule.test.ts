import 'reflect-metadata';

import { createPassthroughTestCryptoTool, createSilentLogger, mockDatabase } from '@core/testUtils/mocks';
import { VaultType } from '@core/database/models/Vault/VaultType';
import { CORE_IDENTIFIERS } from '@core/di';
import { ModuleManager } from '@core/runtime/ModuleManager';
import type { RuntimeScheduler } from '@core/runtime/types';
import type { IAccount, INetwork } from '@core/services';
import { NetworkType } from '@core/types';
import { ChainType } from '@core/utils/consts';
import { Container } from 'inversify';
import { createCryptoToolModule } from '../crypto';
import { createDbModule, DbBootstrapModule } from '../db';
import { type CoreEventMap, type EventBus, EventBusModule } from '../eventBus';
import { ServicesModule } from '../services';
import { TxSyncModule } from './TxSyncModule';

const createSchedulerStub = () => {
  const timeouts = new Map<number, () => void>();
  const intervals = new Map<number, () => void>();
  let nextId = 1;

  const scheduler: RuntimeScheduler = {
    setTimeout: (handler) => {
      const id = nextId++;
      timeouts.set(id, handler);
      return id;
    },
    clearTimeout: (id) => {
      timeouts.delete(id);
    },
    setInterval: (handler) => {
      const id = nextId++;
      intervals.set(id, handler);
      return id;
    },
    clearInterval: (id) => {
      intervals.delete(id);
    },
  };

  const flushTimeouts = () => {
    const pending = Array.from(timeouts.values());
    timeouts.clear();
    pending.forEach((h) => h());
  };

  return {
    scheduler,
    flushTimeouts,
    getCounts: () => ({ timeoutCount: timeouts.size, intervalCount: intervals.size }),
  };
};

describe('TxSyncModule', () => {
  it('start → stop → start does not leak timers/subscriptions (module-level)', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();
    const { scheduler, flushTimeouts, getCounts } = createSchedulerStub();

    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      scheduler,
      config: {
        eventBus: { assertSerializable: true },
        sync: { tx: { scanIntervalMs: 60_000, highPriorityPollIntervalMs: 10_000, backgroundPollIntervalMs: 60_000, globalConcurrency: 2 } },
      },
    });

    manager.register([
      EventBusModule,
      createDbModule({ database }),
      DbBootstrapModule,
      createCryptoToolModule({ cryptoTool: createPassthroughTestCryptoTool() }),
      ServicesModule,
      TxSyncModule,
    ]);

    await manager.start();

    // Allow TxSyncScheduler.pump() to schedule initial work (timeout(0)).
    flushTimeouts();

    // At least one interval should exist (scan loop).
    expect(getCounts().intervalCount).toBeGreaterThan(0);

    await manager.stop();

    // stop() must clear timers.
    expect(getCounts().intervalCount).toBe(0);
    expect(getCounts().timeoutCount).toBe(0);

    // After stop, emitting events should not schedule new pump timeouts.
    const eventBus = manager.context.container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);

    const account: IAccount = {
      id: 'acc_x',
      nickname: 'stub',
      address: '0x0000000000000000000000000000000000000000',
      balance: '0',
      formattedBalance: '0',
      isHardwareWallet: false,
      vaultType: VaultType.HierarchicalDeterministic,
      accountGroupId: 'ag_x',
      index: 0,
      hidden: false,
      selected: true,
      currentAddressId: 'addr_x',
    };

    const network: INetwork = {
      id: 'net_x',
      name: 'stub',
      endpoint: 'https://example.invalid',
      endpointsList: [],
      netId: 0,
      chainId: '0x1',
      gasBuffer: 1,
      networkType: NetworkType.Ethereum,
      chainType: ChainType.Mainnet,
      icon: null,
      scanUrl: null,
      selected: true,
      builtin: true,
    };

    eventBus.emit('account/current-changed', { account });
    eventBus.emit('network/current-changed', { network });
    eventBus.emit('tx/created', { key: { addressId: 'addr_x', networkId: 'net_x' }, txId: 'tx_x' });
    eventBus.emit('tx/created', { key: { addressId: 'addr_x', networkId: 'net_x' }, txId: 'tx_x' });

    expect(getCounts().timeoutCount).toBe(0);
    expect(getCounts().intervalCount).toBe(0);

    await manager.start();
    flushTimeouts();

    // Second start should recreate interval(s).
    expect(getCounts().intervalCount).toBeGreaterThan(0);

    await manager.stop();
    expect(getCounts().intervalCount).toBe(0);
    expect(getCounts().timeoutCount).toBe(0);
  });
});
