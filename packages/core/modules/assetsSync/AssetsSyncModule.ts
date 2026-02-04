import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeContext, RuntimeModule } from '@core/runtime/types';
import { AccountService } from '@core/services/account';
import { AssetService } from '@core/services/asset';
import { NetworkService } from '@core/services/network';
import type { CoreEventMap, EventBus } from '../eventBus';
import { ASSETS_SYNC_MODULE_ID, EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID } from '../ids';
import { AssetsSyncService } from './AssetsSyncService';

type AssetsSyncRuntimeConfig = {
  pollIntervalMs?: number;
};

const readAssetsSyncConfig = (context: RuntimeContext): Required<AssetsSyncRuntimeConfig> => {
  const root = (context.config as Record<string, unknown>) ?? {};
  const sync = root.sync && typeof root.sync === 'object' ? (root.sync as Record<string, unknown>) : {};
  const assets = sync.assets && typeof sync.assets === 'object' ? (sync.assets as Record<string, unknown>) : {};

  const pollIntervalMs = typeof assets.pollIntervalMs === 'number' && assets.pollIntervalMs > 0 ? assets.pollIntervalMs : 0;

  return { pollIntervalMs };
};

export const AssetsSyncModule: RuntimeModule = {
  id: ASSETS_SYNC_MODULE_ID,
  dependencies: [EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID],

  register: (context) => {
    const { container } = context;
    if (container.isBound(AssetsSyncService)) return;

    const { pollIntervalMs } = readAssetsSyncConfig(context);

    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
    const accountService = container.get(AccountService);
    const assetService = container.get(AssetService);
    const networkService = container.get(NetworkService);

    container.bind(AssetsSyncService).toConstantValue(
      new AssetsSyncService({
        eventBus,
        accountService,
        assetService,
        networkService,
        scheduler: context.scheduler,
        now: context.now,
        logger: context.logger,
        pollIntervalMs,
      }),
    );
  },

  start: ({ container }) => {
    if (!container.isBound(AssetsSyncService)) return;
    container.get(AssetsSyncService).start();
  },

  stop: ({ container }) => {
    if (!container.isBound(AssetsSyncService)) return;
    container.get(AssetsSyncService).stop();
  },
};
