import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeContext, RuntimeModule } from '@core/runtime/types';
import { AccountService } from '@core/services/account';
import { NetworkService } from '@core/services/network';
import type { CoreEventMap, EventBus } from '../eventBus';
import { EVENT_BUS_MODULE_ID, NFT_SYNC_MODULE_ID, SERVICES_MODULE_ID } from '../ids';
import { NftSyncService } from './NftSyncService';

type NftSyncRuntimeConfig = {
  pollIntervalMs?: number;
  scanOpenApiByKey?: Record<string, string>;
};

const readNftSyncConfig = (context: RuntimeContext): Required<NftSyncRuntimeConfig> => {
  const root = (context.config as Record<string, unknown>) ?? {};
  const sync = root.sync && typeof root.sync === 'object' ? (root.sync as Record<string, unknown>) : {};
  const nft = sync.nft && typeof sync.nft === 'object' ? (sync.nft as Record<string, unknown>) : {};

  const pollIntervalMs = typeof nft.pollIntervalMs === 'number' && nft.pollIntervalMs > 0 ? nft.pollIntervalMs : 0;

  const scanOpenApiByKey = nft.scanOpenApiByKey && typeof nft.scanOpenApiByKey === 'object' ? (nft.scanOpenApiByKey as Record<string, string>) : {};

  return { pollIntervalMs, scanOpenApiByKey };
};

export const NftSyncModule: RuntimeModule = {
  id: NFT_SYNC_MODULE_ID,
  dependencies: [EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID],

  register: (context) => {
    const { container } = context;
    if (container.isBound(NftSyncService)) return;

    const { pollIntervalMs, scanOpenApiByKey } = readNftSyncConfig(context);

    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
    const accountService = container.get(AccountService);
    const networkService = container.get(NetworkService);

    container.bind(NftSyncService).toConstantValue(
      new NftSyncService({
        eventBus,
        accountService,
        networkService,
        scheduler: context.scheduler,
        now: context.now,
        logger: context.logger,
        pollIntervalMs,
        scanOpenApiByKey,
      }),
    );
  },

  start: ({ container }) => {
    if (!container.isBound(NftSyncService)) return;
    container.get(NftSyncService).start();
  },

  stop: ({ container }) => {
    if (!container.isBound(NftSyncService)) return;
    container.get(NftSyncService).stop();
  },
};
