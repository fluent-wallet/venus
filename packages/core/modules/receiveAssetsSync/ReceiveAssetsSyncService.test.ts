import 'reflect-metadata';

import { createTestAccount, seedNetwork } from '@core/__tests__/fixtures';
import { createSilentLogger, mockDatabase } from '@core/__tests__/mocks';
import { StubChainProvider } from '@core/__tests__/mocks/chainProviders';
import { ChainRegistry } from '@core/chains';
import ESpaceTokenList from '@core/contracts/ABI/ESpaceTokenList';
import type { Asset } from '@core/database/models/Asset';
import { AssetSource, AssetType } from '@core/database/models/Asset';
import TableName from '@core/database/TableName';
import { type CoreEventMap, InMemoryEventBus } from '@core/modules/eventBus';
import { convertToChecksum } from '@core/utils/account';
import { Interface } from '@ethersproject/abi';
import { Q } from '@nozbe/watermelondb';
import { ReceiveAssetsSyncService } from './ReceiveAssetsSyncService';

const tokenListIface = new Interface(ESpaceTokenList);

const waitForFirst = async (params: {
  eventBus: InMemoryEventBus<CoreEventMap>;
  timeoutMs?: number;
}): Promise<
  { kind: 'succeeded'; payload: CoreEventMap['receive-assets-sync/succeeded'] } | { kind: 'failed'; payload: CoreEventMap['receive-assets-sync/failed'] }
> => {
  const { eventBus, timeoutMs = 2000 } = params;

  return (await Promise.race([
    new Promise((resolve) => {
      const s1 = eventBus.on('receive-assets-sync/succeeded', (payload) => {
        s1.unsubscribe();
        s2.unsubscribe();
        resolve({ kind: 'succeeded', payload });
      });
      const s2 = eventBus.on('receive-assets-sync/failed', (payload) => {
        s1.unsubscribe();
        s2.unsubscribe();
        resolve({ kind: 'failed', payload });
      });
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout waiting receive-assets-sync event')), timeoutMs);
    }),
  ])) as any;
};

describe('ReceiveAssetsSyncService', () => {
  it('creates Official ERC20 into current address assetRule', async () => {
    const db = mockDatabase();
    const logger = createSilentLogger();

    const { network, assetRule } = await seedNetwork(db, { definitionKey: 'Conflux eSpace', selected: true });
    const { address } = await createTestAccount(db, { network, assetRule, selected: true });

    const accountService: any = {
      getCurrentAccount: jest.fn(async () => ({ currentAddressId: address.id })),
    };

    const networkService: any = {
      getCurrentNetwork: jest.fn(async () => ({ id: network.id, chainId: network.chainId, networkType: network.networkType })),
    };
    const chainRegistry = new ChainRegistry();
    const provider = new StubChainProvider({ chainId: network.chainId, networkType: network.networkType });

    const token = '0x0000000000000000000000000000000000000001';
    const checksumToken = convertToChecksum(token);

    const callData = tokenListIface.encodeFunctionData('listTokens', [20n, 0n, 200n]);
    const callResult = tokenListIface.encodeFunctionResult('listTokens', [1n, [checksumToken]]);

    provider.setCallResponse('0xf1a8b97ef61bf8fe3c54c94a16c57c0f7afc2277', callData as any, callResult as any);
    chainRegistry.register(provider);

    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger, assertSerializable: true });

    const fetchFn = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: '1',
          message: 'ok',
          result: [{ contract: checksumToken, name: 'Token', symbol: 'TKN', decimals: 18, iconUrl: 'https://icon' }],
        }),
      } as unknown as Response;
    });

    const service = new ReceiveAssetsSyncService({
      db: db,
      chainRegistry,
      accountService,
      networkService,
      eventBus,
      now: () => 1700000000000,
      logger,
      fetchFn,
    });
    const p = waitForFirst({ eventBus });
    service.start();

    try {
      const first = await p;
      expect(first.kind).toBe('succeeded');
      expect(fetchFn).toHaveBeenCalled();

      const assets = await db.get<Asset>(TableName.Asset).query(Q.where('asset_rule_id', assetRule.id), Q.where('contract_address', checksumToken)).fetch();

      expect(assets).toHaveLength(1);
      expect(assets[0].type).toBe(AssetType.ERC20);
      expect(assets[0].source).toBe(AssetSource.Official);
    } finally {
      service.stop();
    }
  });

  it('updates metadata but keeps source=Custom (strategy #2)', async () => {
    const db = mockDatabase();
    const logger = createSilentLogger();
    const { network, assetRule } = await seedNetwork(db, { definitionKey: 'Conflux eSpace', selected: true });
    const { address } = await createTestAccount(db, { network, assetRule, selected: true });

    const accountService: any = {
      getCurrentAccount: jest.fn(async () => ({ currentAddressId: address.id })),
    };

    const networkService: any = {
      getCurrentNetwork: jest.fn(async () => ({ id: network.id, chainId: network.chainId, networkType: network.networkType })),
    };

    const token = '0x0000000000000000000000000000000000000002';
    const checksumToken = convertToChecksum(token);

    await db.write(async () => {
      await db.get<Asset>(TableName.Asset).create((record) => {
        record.network.set(network);
        record.assetRule.set(assetRule);
        record.type = AssetType.ERC20;
        record.contractAddress = checksumToken;
        record.name = 'Old';
        record.symbol = 'OLD';
        record.decimals = 6;
        record.icon = null;
        record.source = AssetSource.Custom;
        record.priceInUSDT = null;
      });
    });

    const chainRegistry = new ChainRegistry();
    const provider = new StubChainProvider({ chainId: network.chainId, networkType: network.networkType });

    const callData = tokenListIface.encodeFunctionData('listTokens', [20n, 0n, 200n]);
    const callResult = tokenListIface.encodeFunctionResult('listTokens', [1n, [checksumToken]]);

    provider.setCallResponse('0xf1a8b97ef61bf8fe3c54c94a16c57c0f7afc2277', callData as any, callResult as any);
    chainRegistry.register(provider);

    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger, assertSerializable: true });

    const fetchFn = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: '1',
          message: 'ok',
          result: [{ contract: checksumToken, name: 'NewName', symbol: 'NEW', decimals: 18, iconUrl: 'https://icon2' }],
        }),
      } as unknown as Response;
    });

    const service = new ReceiveAssetsSyncService({
      db: db,
      chainRegistry,
      accountService,
      networkService,
      eventBus,
      now: () => 1700000000000,
      logger,
      fetchFn,
    });
    const p = waitForFirst({ eventBus });
    service.start();

    try {
      const first = await p;
      expect(first.kind).toBe('succeeded');
      expect(fetchFn).toHaveBeenCalled();

      if (first.kind === 'succeeded') {
        expect(first.payload.createdCount).toBe(0);
        expect(first.payload.updatedCount).toBe(1);
      }

      const assets = await db.get<Asset>(TableName.Asset).query(Q.where('asset_rule_id', assetRule.id), Q.where('contract_address', checksumToken)).fetch();

      expect(assets).toHaveLength(1);
      expect(assets[0].name).toBe('NewName');
      expect(assets[0].symbol).toBe('NEW');
      expect(assets[0].source).toBe(AssetSource.Custom);
    } finally {
      service.stop();
    }
  });
});
