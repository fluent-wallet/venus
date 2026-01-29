import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeModule } from '@core/runtime/types';
import { AccountService } from '@core/services/account';
import { NetworkService } from '@core/services/network';
import type { CoreEventMap, EventBus } from '../eventBus';
import { EVENT_BUS_MODULE_ID, RECEIVE_ASSETS_SYNC_MODULE_ID, SERVICES_MODULE_ID } from '../ids';

import { ReceiveAssetsSyncService } from './ReceiveAssetsSyncService';

export const ReceiveAssetsSyncModule: RuntimeModule = {
  id: RECEIVE_ASSETS_SYNC_MODULE_ID,
  dependencies: [EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID],

  register: (context) => {
    const { container } = context;
    if (container.isBound(ReceiveAssetsSyncService)) return;
    const db = container.get<Database>(CORE_IDENTIFIERS.DB);
    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
    const chainRegistry = container.get(ChainRegistry);
    const accountService = container.get(AccountService);
    const networkService = container.get(NetworkService);

    container.bind(ReceiveAssetsSyncService).toConstantValue(
      new ReceiveAssetsSyncService({
        db,
        chainRegistry,
        accountService,
        networkService,
        eventBus,
        now: context.now,
        logger: context.logger,
      }),
    );
  },

  start: ({ container }) => {
    if (!container.isBound(ReceiveAssetsSyncService)) return;
    container.get(ReceiveAssetsSyncService).start();
  },

  stop: ({ container }) => {
    if (!container.isBound(ReceiveAssetsSyncService)) return;
    container.get(ReceiveAssetsSyncService).stop();
  },
};
