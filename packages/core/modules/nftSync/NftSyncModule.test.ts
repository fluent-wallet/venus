import 'reflect-metadata';

import { createTestAccount, seedNetwork } from '@core/testUtils/fixtures';
import { createPassthroughTestCryptoTool, createSilentLogger, mockDatabase } from '@core/testUtils/mocks';
import type { Database } from '@core/database';
import { CORE_IDENTIFIERS } from '@core/di';
import { NFT_SYNC_FETCH_FAILED } from '@core/errors';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import { EventBusModule } from '@core/modules/eventBus';
import { ModuleManager } from '@core/runtime/ModuleManager';
import { NetworkService } from '@core/services';
import { Container } from 'inversify';
import { createCryptoToolModule } from '../crypto';
import { createDbModule, DbBootstrapModule } from '../db';
import { ServicesModule } from '../services';
import { NftSyncModule } from './NftSyncModule';
import { NftSyncService } from './NftSyncService';

describe('NftSyncModule', () => {
  it('emits succeeded snapshot on manual refresh (serializable)', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();

    const fetchFn = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: '1',
          message: 'ok',
          result: {
            list: [{ amount: '1', description: 'desc', image: 'https://icon', name: 'NFT #1', tokenId: '1' }],
          },
        }),
      } as unknown as Response;
    });

    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        eventBus: { assertSerializable: true },
        sync: {
          nft: {
            pollIntervalMs: 0,
            scanOpenApiByKey: {
              'Ethereum:0x406': 'https://evmapi.confluxscan.org',
            },
          },
        },
      },
    });

    manager.register([
      EventBusModule,
      createDbModule({ database }),
      DbBootstrapModule,
      createCryptoToolModule({ cryptoTool: createPassthroughTestCryptoTool() }),
      ServicesModule,
      NftSyncModule,
    ]);
    await manager.start();

    const originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch?: unknown }).fetch = fetchFn;

    try {
      const db = container.get<Database>(CORE_IDENTIFIERS.DB);

      const { network, assetRule } = await seedNetwork(db, { definitionKey: 'Conflux eSpace', selected: true });

      const networkService = container.get(NetworkService);
      await networkService.switchNetwork(network.id);

      await createTestAccount(db, { network, assetRule, selected: true });

      const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
      const succeeded: CoreEventMap['nft-sync/succeeded'][] = [];
      eventBus.on('nft-sync/succeeded', (payload) => succeeded.push(payload));

      const service = container.get(NftSyncService);

      service.setCurrentTarget({ contractAddress: '0x0000000000000000000000000000000000000001' });
      await service.refreshCurrent({ reason: 'manual' });

      expect(succeeded).toHaveLength(1);
      expect(succeeded[0].snapshot.items).toHaveLength(1);
      expect(succeeded[0].snapshot.items[0].tokenId).toBe('1');
    } finally {
      (globalThis as unknown as { fetch?: unknown }).fetch = originalFetch;
      await manager.stop();
    }
  });
  it('emits failed with NFT_SYNC_FETCHER_NOT_CONFIGURED when baseUrl missing', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();

    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        eventBus: { assertSerializable: true },
        sync: { nft: { pollIntervalMs: 0, scanOpenApiByKey: {} } },
      },
    });

    manager.register([
      EventBusModule,
      createDbModule({ database }),
      DbBootstrapModule,
      createCryptoToolModule({ cryptoTool: createPassthroughTestCryptoTool() }),
      ServicesModule,
      NftSyncModule,
    ]);
    await manager.start();

    try {
      const db = container.get<Database>(CORE_IDENTIFIERS.DB);

      const { network, assetRule } = await seedNetwork(db, { definitionKey: 'Conflux eSpace', selected: true });

      const networkService = container.get(NetworkService);
      await networkService.switchNetwork(network.id);

      await createTestAccount(db, { network, assetRule, selected: true });

      const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
      const failed: CoreEventMap['nft-sync/failed'][] = [];
      eventBus.on('nft-sync/failed', (payload) => failed.push(payload));

      const service = container.get(NftSyncService);

      service.setCurrentTarget({ contractAddress: '0x0000000000000000000000000000000000000001' });
      await service.refreshCurrent({ reason: 'manual' });

      expect(failed).toHaveLength(1);
      expect(failed[0].error.code).toBe('NFT_SYNC_FETCHER_NOT_CONFIGURED');
    } finally {
      await manager.stop();
    }
  });

  it('emits failed with NFT_SYNC_FETCH_FAILED when fetch returns non-ok', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();

    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        eventBus: { assertSerializable: true },
        sync: {
          nft: {
            pollIntervalMs: 0,
            scanOpenApiByKey: {
              'Ethereum:0x406': 'https://evmapi.confluxscan.org',
            },
          },
        },
      },
    });

    manager.register([
      EventBusModule,
      createDbModule({ database }),
      DbBootstrapModule,
      createCryptoToolModule({ cryptoTool: createPassthroughTestCryptoTool() }),
      ServicesModule,
      NftSyncModule,
    ]);

    await manager.start();

    const originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch?: unknown }).fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({}),
      } as unknown as Response;
    });

    try {
      const db = container.get<Database>(CORE_IDENTIFIERS.DB);

      const { network, assetRule } = await seedNetwork(db, { definitionKey: 'Conflux eSpace', selected: true });

      const networkService = container.get(NetworkService);
      await networkService.switchNetwork(network.id);

      await createTestAccount(db, { network, assetRule, selected: true });

      const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
      const failed: CoreEventMap['nft-sync/failed'][] = [];
      eventBus.on('nft-sync/failed', (payload) => failed.push(payload));

      const service = container.get(NftSyncService);

      service.setCurrentTarget({ contractAddress: '0x0000000000000000000000000000000000000001' });
      await service.refreshCurrent({ reason: 'manual' });

      expect(failed).toHaveLength(1);
      expect(failed[0].error.code).toBe(NFT_SYNC_FETCH_FAILED);
    } finally {
      (globalThis as unknown as { fetch?: unknown }).fetch = originalFetch;
      await manager.stop();
    }
  });

  it('emits aborted failed event when target changes during in-flight refresh', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();

    const fetchFn = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      await new Promise<void>((resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new Error('aborted'));
          return;
        }
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        // keep pending until abort
      });

      return {
        ok: true,
        status: 200,
        json: async () => ({ status: '1', message: 'ok', result: { list: [] } }),
      } as unknown as Response;
    });

    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        eventBus: { assertSerializable: true },
        sync: {
          nft: {
            pollIntervalMs: 0,
            scanOpenApiByKey: {
              'Ethereum:0x406': 'https://evmapi.confluxscan.org',
            },
          },
        },
      },
    });

    manager.register([
      EventBusModule,
      createDbModule({ database }),
      DbBootstrapModule,
      createCryptoToolModule({ cryptoTool: createPassthroughTestCryptoTool() }),
      ServicesModule,
      NftSyncModule,
    ]);

    await manager.start();

    const originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch?: unknown }).fetch = fetchFn;

    try {
      const db = container.get<Database>(CORE_IDENTIFIERS.DB);

      const { network, assetRule } = await seedNetwork(db, { definitionKey: 'Conflux eSpace', selected: true });

      const networkService = container.get(NetworkService);
      await networkService.switchNetwork(network.id);

      await createTestAccount(db, { network, assetRule, selected: true });

      const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
      const failed: CoreEventMap['nft-sync/failed'][] = [];
      eventBus.on('nft-sync/failed', (payload) => failed.push(payload));

      const started = new Promise<void>((resolve) => {
        const sub = eventBus.on('nft-sync/started', () => {
          sub.unsubscribe();
          resolve();
        });
      });

      const service = container.get(NftSyncService);

      service.setCurrentTarget({ contractAddress: '0x0000000000000000000000000000000000000001' });
      const p = service.refreshCurrent({ reason: 'manual' });

      await started;

      service.setCurrentTarget({ contractAddress: '0x0000000000000000000000000000000000000002' });

      await p;

      expect(failed.some((x) => x.error.context && (x.error.context as any).aborted === true)).toBe(true);
    } finally {
      (globalThis as unknown as { fetch?: unknown }).fetch = originalFetch;
      await manager.stop();
    }
  });
});
