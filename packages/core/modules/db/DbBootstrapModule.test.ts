import 'reflect-metadata';

import { createSilentLogger, mockDatabase } from '@core/__tests__/mocks';
import { ChainRegistry } from '@core/chains';
import type { Asset } from '@core/database/models/Asset';
import { AssetSource, AssetType } from '@core/database/models/Asset';
import type { AssetRule } from '@core/database/models/AssetRule';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { EventBusModule } from '@core/modules/eventBus';
import { ModuleManager } from '@core/runtime/ModuleManager';
import type { CryptoTool } from '@core/types/crypto';
import { DEFAULT_CFX_HDPATH, DEFAULT_ETH_HDPATH, Networks } from '@core/utils/consts';
import { Q } from '@nozbe/watermelondb';
import { Container } from 'inversify';
import { createCryptoToolModule } from '../crypto';
import { ServicesModule } from '../services';
import { DbBootstrapModule } from './DbBootstrapModule';
import { createDbModule } from './DbModule';

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

describe('DbBootstrapModule', () => {
  it('seeds builtin defaults on empty DB and enables ServicesModule provider registration', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();

    const manager = new ModuleManager({ logger: createSilentLogger(), container });

    manager.register([
      createDbModule({ database }),
      DbBootstrapModule,
      createCryptoToolModule({ cryptoTool: new FakeCryptoTool() }),
      EventBusModule,
      ServicesModule,
    ]);

    await manager.start();

    const networks = await database.get<Network>(TableName.Network).query().fetch();
    expect(networks.length).toBe(Object.keys(Networks).length);

    const expectedSelectedKey = (Object.entries(Networks).find(([, def]) => def.selected)?.[0] ?? Object.keys(Networks)[0]) as keyof typeof Networks;

    const selected = networks.filter((n) => n.selected);
    expect(selected.length).toBe(1);
    expect(selected[0]?.name).toBe(Networks[expectedSelectedKey].name);

    const entries = Object.entries(Networks) as Array<[keyof typeof Networks, (typeof Networks)[keyof typeof Networks]]>;

    for (const [key, def] of entries) {
      const match = networks.find((n) => n.chainId === def.chainId && n.networkType === def.networkType);
      expect(match).toBeTruthy();

      const network = match!;
      expect(network.name).toBe(def.name);
      expect(network.endpoint).toBe(def.endpoint);
      expect(network.netId).toBe(def.netId);
      expect(network.chainType).toBe(def.chainType);
      expect(network.selected).toBe(key === expectedSelectedKey);
      expect(network.endpointsList.some((e) => e.endpoint === def.endpoint && e.type === 'inner')).toBe(true);

      const hdPath = await network.hdPath.fetch();
      const expectedHdPathValue = def.hdPathIndex === 0 ? DEFAULT_CFX_HDPATH : DEFAULT_ETH_HDPATH;
      expect(hdPath.value).toBe(expectedHdPathValue);

      const rules = await database.get<AssetRule>(TableName.AssetRule).query(Q.where('network_id', network.id), Q.where('index', 0)).fetch();

      expect(rules).toHaveLength(1);
      const rule = rules[0];

      const nativeAssets = await database
        .get<Asset>(TableName.Asset)
        .query(Q.where('network_id', network.id), Q.where('asset_rule_id', rule.id), Q.where('type', AssetType.Native))
        .fetch();

      expect(nativeAssets).toHaveLength(1);
      expect(nativeAssets[0].contractAddress).toBe('');
      expect(nativeAssets[0].source).toBe(AssetSource.Official);
    }

    const chainRegistry = container.get(ChainRegistry);
    const expectedProviders = new Set(Object.values(Networks).map((def) => `${def.networkType}:${def.chainId.toLowerCase()}`));
    expect(chainRegistry.size).toBe(expectedProviders.size);

    for (const def of Object.values(Networks)) {
      expect(chainRegistry.has(def.chainId, def.networkType)).toBe(true);
    }

    await manager.stop();
  });
});
