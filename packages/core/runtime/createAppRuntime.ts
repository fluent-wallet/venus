import 'reflect-metadata';

import { AuthModule } from '@core/modules/auth';
import { CryptoToolServer, createCryptoToolModule } from '@core/modules/crypto';
import { createDbModule, DbBootstrapModule } from '@core/modules/db';
import { EventBusModule } from '@core/modules/eventBus';
import { ExternalRequestsModule } from '@core/modules/externalRequests';
import { ServicesModule } from '@core/modules/services';
import type { Database } from '@nozbe/watermelondb';
import { ModuleManager, type ModuleManagerOptions } from './ModuleManager';

export type CreateAppRuntimeOptions = ModuleManagerOptions & {
  database: Database;
};

export function createAppRuntime(options: CreateAppRuntimeOptions): ModuleManager {
  const manager = new ModuleManager(options);

  manager.register([
    createDbModule({ database: options.database }),
    DbBootstrapModule,

    createCryptoToolModule({ cryptoTool: new CryptoToolServer() }),

    EventBusModule,
    AuthModule,
    ExternalRequestsModule,

    ServicesModule,
  ]);

  return manager;
}
