import 'reflect-metadata';
import { createTestAccount, seedNetwork } from '@core/__tests__/fixtures';
import { createPassthroughTestCryptoTool, createSilentLogger, mockDatabase } from '@core/__tests__/mocks';
import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Asset } from '@core/database/models/Asset';
import { AssetSource, AssetType } from '@core/database/models/Asset';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CHAIN_PROVIDER_NOT_FOUND } from '@core/errors';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import { EventBusModule } from '@core/modules/eventBus';
import { ModuleManager } from '@core/runtime/ModuleManager';
import { Container } from 'inversify';
import { createCryptoToolModule } from '../crypto';
import { createDbModule, DbBootstrapModule } from '../db';
import { ServicesModule } from '../services';
import { AssetsSyncModule } from './AssetsSyncModule';
import { AssetsSyncService } from './AssetsSyncService';
import { NetworkService } from '@core/services';

describe('AssetsSyncModule', () => {
  it('emits succeeded snapshot on manual refresh (serializable)', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();

    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        eventBus: { assertSerializable: true },
        sync: { assets: { pollIntervalMs: 0 } },
      },
    });

    manager.register([
      EventBusModule,
      createDbModule({ database }),
      DbBootstrapModule,
      createCryptoToolModule({ cryptoTool: createPassthroughTestCryptoTool() }),
      ServicesModule,
      AssetsSyncModule,
    ]);
    await manager.start();

    try {
      const db = container.get<Database>(CORE_IDENTIFIERS.DB);

      const { network, assetRule } = await seedNetwork(db, { selected: true });

      const networkService = container.get(NetworkService);
      await networkService.switchNetwork(network.id);

      await createTestAccount(db, { network, assetRule, selected: true });

      await db.write(async () => {
        await db.get<Asset>(TableName.Asset).create((record) => {
          record.assetRule.set(assetRule);
          record.network.set(network);
          record.type = AssetType.Native;
          record.contractAddress = '';
          record.name = 'Conflux';
          record.symbol = 'CFX';
          record.decimals = 18;
          record.icon = null;
          record.source = AssetSource.Official;
          record.priceInUSDT = null;
        });
      });

      const chainRegistry = container.get(ChainRegistry);
      const provider = chainRegistry.get(network.chainId, network.networkType);
      if (!provider) {
        throw new Error('Test setup error: missing chain provider in ChainRegistry.');
      }

      (provider as any).getBalance = jest.fn(async () => '0xde0b6b3a7640000'); // 1

      const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
      const succeeded: CoreEventMap['assets-sync/succeeded'][] = [];
      eventBus.on('assets-sync/succeeded', (payload) => succeeded.push(payload));

      const service = container.get(AssetsSyncService);

      const p1 = service.refreshCurrent({ reason: 'manual' });
      const p2 = service.refreshCurrent({ reason: 'manual' });
      await Promise.all([p1, p2]);

      expect(succeeded).toHaveLength(1);
      expect(succeeded[0].snapshot.assets).toHaveLength(1);
      expect(succeeded[0].snapshot.assets[0].type).toBe(AssetType.Native);
      expect(succeeded[0].snapshot.assets[0].balance).toBe('1');
    } finally {
      await manager.stop();
    }
  });

  it('emits failed with CHAIN_PROVIDER_NOT_FOUND when chain provider missing', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();

    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        eventBus: { assertSerializable: true },
        sync: { assets: { pollIntervalMs: 0 } },
      },
    });

    manager.register([
      EventBusModule,
      createDbModule({ database }),
      DbBootstrapModule,
      createCryptoToolModule({ cryptoTool: createPassthroughTestCryptoTool() }),
      ServicesModule,
      AssetsSyncModule,
    ]);

    await manager.start();

    try {
      const db = container.get<Database>(CORE_IDENTIFIERS.DB);

      const { network, assetRule } = await seedNetwork(db, { selected: true });

      const networkService = container.get(NetworkService);
      await networkService.switchNetwork(network.id);

      await createTestAccount(db, { network, assetRule, selected: true });

      await db.write(async () => {
        await db.get<Asset>(TableName.Asset).create((record) => {
          record.assetRule.set(assetRule);
          record.network.set(network);
          record.type = AssetType.Native;
          record.contractAddress = '';
          record.name = 'Conflux';
          record.symbol = 'CFX';
          record.decimals = 18;
          record.icon = null;
          record.source = AssetSource.Official;
          record.priceInUSDT = null;
        });
      });

      const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
      const failed: CoreEventMap['assets-sync/failed'][] = [];
      eventBus.on('assets-sync/failed', (payload) => failed.push(payload));

      const service = container.get(AssetsSyncService);

      const chainRegistry = container.get(ChainRegistry);

      (chainRegistry as any).providers.clear();

      await service.refreshCurrent({ reason: 'manual' });

      expect(failed).toHaveLength(1);
      expect(failed[0].error.code).toBe(CHAIN_PROVIDER_NOT_FOUND);
    } finally {
      await manager.stop();
    }
  });
});
