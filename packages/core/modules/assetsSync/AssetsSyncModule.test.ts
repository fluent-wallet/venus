import 'reflect-metadata';

import { createTestAccount, seedNetwork } from '@core/__tests__/fixtures';
import { createSilentLogger, mockDatabase } from '@core/__tests__/mocks';
import { StubChainProvider } from '@core/__tests__/mocks/chainProviders';
import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Asset } from '@core/database/models/Asset';
import { AssetSource, AssetType } from '@core/database/models/Asset';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import { EventBusModule } from '@core/modules/eventBus';
import { ModuleManager } from '@core/runtime/ModuleManager';
import type { CryptoTool } from '@core/types/crypto';
import { Container } from 'inversify';
import { createCryptoToolModule } from '../crypto';
import { createDbModule } from '../db';
import { ServicesModule } from '../services';
import { AssetsSyncModule } from './AssetsSyncModule';
import { AssetsSyncService } from './AssetsSyncService';

class FakeCryptoTool implements CryptoTool {
  generateRandomString(_byteCount?: number): string {
    return 'stub';
  }
  async encrypt(data: unknown): Promise<string> {
    return JSON.stringify({ data });
  }
  async decrypt<T = unknown>(encryptedDataString: string): Promise<T> {
    return JSON.parse(encryptedDataString).data as T;
  }
}

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
      createCryptoToolModule({ cryptoTool: new FakeCryptoTool() }),
      ServicesModule,
      AssetsSyncModule,
    ]);

    await manager.start();

    try {
      const db = container.get<Database>(CORE_IDENTIFIERS.DB);

      const { network, assetRule } = await seedNetwork(db, { selected: true });
      const { address } = await createTestAccount(db, { network, assetRule, selected: true });

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
      const provider = new StubChainProvider({ chainId: network.chainId, networkType: network.networkType });
      provider.setNativeBalance(await address.getValue(), '0xde0b6b3a7640000'); // 1
      chainRegistry.register(provider);

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
});
