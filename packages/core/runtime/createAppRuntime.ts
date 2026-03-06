import 'reflect-metadata';

import defaultDatabase from '@core/database';
import { AssetsSyncModule } from '@core/modules/assetsSync';
import { AuthModule } from '@core/modules/auth';
import { CryptoToolServer, createCryptoToolModule } from '@core/modules/crypto';
import { createDbModule, DbBootstrapModule } from '@core/modules/db';
import { EventBusModule } from '@core/modules/eventBus';
import { ExternalRequestsModule } from '@core/modules/externalRequests';
import { NftSyncModule } from '@core/modules/nftSync';
import { ReceiveAssetsSyncModule } from '@core/modules/receiveAssetsSync';
import { ServicesModule } from '@core/modules/services';
import { TxSyncModule } from '@core/modules/txSync';
import { WalletConnectModule } from '@core/modules/walletConnect';
import type { Database } from '@nozbe/watermelondb';
import { ModuleManager, type ModuleManagerOptions } from './ModuleManager';

export type CreateAppRuntimeOptions = ModuleManagerOptions & {
  database?: Database;
};

export function createAppRuntime(options: CreateAppRuntimeOptions): ModuleManager {
  const manager = new ModuleManager(options);
  const database = options.database ?? defaultDatabase;

  manager.register([
    createDbModule({ database }),
    DbBootstrapModule,

    createCryptoToolModule({ cryptoTool: new CryptoToolServer() }),

    EventBusModule,
    AuthModule,
    ExternalRequestsModule,

    WalletConnectModule,

    ServicesModule,

    // Receive-assets sync keeps the local ERC20 list in sync for supported EVM networks.
    ReceiveAssetsSyncModule,

    // Asset sync is event-driven by default (polling is controlled by runtime config).
    AssetsSyncModule,

    // Pending tx refresh after legacy trackers are removed.
    TxSyncModule,

    // NFT sync is event-driven by default (polling is controlled by runtime config).
    NftSyncModule,
  ]);

  return manager;
}
