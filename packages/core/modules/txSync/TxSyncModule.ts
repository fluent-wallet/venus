import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CHAIN_PROVIDER_NOT_FOUND, CoreError } from '@core/errors';
import type { RuntimeContext, RuntimeModule } from '@core/runtime/types';
import { AccountService } from '@core/services/account';
import { NetworkService } from '@core/services/network';
import type { CoreEventMap, EventBus } from '../eventBus';
import { EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID, TX_SYNC_MODULE_ID } from '../ids';
import { TxSyncEngine } from './TxSyncEngine';
import { TxSyncScheduler } from './TxSyncScheduler';
import { TxSyncService } from './TxSyncService';

type TxSyncRuntimeConfig = {
  globalConcurrency?: number;
  highPriorityPollIntervalMs?: number;
  backgroundPollIntervalMs?: number;
  scanIntervalMs?: number;
};

const readTxSyncConfig = (context: RuntimeContext): Required<TxSyncRuntimeConfig> => {
  const root = (context.config as Record<string, unknown>) ?? {};
  const sync = root.sync && typeof root.sync === 'object' ? (root.sync as Record<string, unknown>) : {};
  const tx = sync.tx && typeof sync.tx === 'object' ? (sync.tx as Record<string, unknown>) : {};

  const globalConcurrency = typeof tx.globalConcurrency === 'number' && tx.globalConcurrency > 0 ? tx.globalConcurrency : 4;
  const highPriorityPollIntervalMs =
    typeof tx.highPriorityPollIntervalMs === 'number' && tx.highPriorityPollIntervalMs > 0 ? tx.highPriorityPollIntervalMs : 10_000;
  const backgroundPollIntervalMs = typeof tx.backgroundPollIntervalMs === 'number' && tx.backgroundPollIntervalMs > 0 ? tx.backgroundPollIntervalMs : 60_000;
  const scanIntervalMs = typeof tx.scanIntervalMs === 'number' && tx.scanIntervalMs > 0 ? tx.scanIntervalMs : 60_000;

  return { globalConcurrency, highPriorityPollIntervalMs, backgroundPollIntervalMs, scanIntervalMs };
};

export const TxSyncModule: RuntimeModule = {
  id: TX_SYNC_MODULE_ID,
  dependencies: [EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID],

  register: (context) => {
    const { container } = context;
    if (container.isBound(TxSyncScheduler)) return;

    const { globalConcurrency, highPriorityPollIntervalMs, backgroundPollIntervalMs, scanIntervalMs } = readTxSyncConfig(context);

    const db = container.get<Database>(CORE_IDENTIFIERS.DB);
    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);

    const accountService = container.get(AccountService);
    const networkService = container.get(NetworkService);

    const engine = new TxSyncEngine();
    const service = new TxSyncService({ db, engine, now: context.now });

    const chainRegistry = container.get(ChainRegistry);

    const getProvider = async (key: { addressId: string; networkId: string }) => {
      const address = await db.get<Address>(TableName.Address).find(key.addressId);
      const addressNetworkId = (await address.network.fetch()).id;

      if (addressNetworkId !== key.networkId) {
        throw new Error(`TxSyncModule:getProvider key mismatch: address.networkId=${addressNetworkId} key.networkId=${key.networkId}`);
      }

      const network = await db.get<Network>(TableName.Network).find(key.networkId);

      const provider = chainRegistry.get(network.chainId, network.networkType);
      if (!provider) {
        throw new CoreError({
          code: CHAIN_PROVIDER_NOT_FOUND,
          message: 'Chain provider not found.',
          context: { addressId: key.addressId, networkId: key.networkId, chainId: network.chainId, networkType: network.networkType },
        });
      }

      return provider;
    };
    container.bind(TxSyncService).toConstantValue(service);

    container.bind(TxSyncScheduler).toConstantValue(
      new TxSyncScheduler({
        eventBus,
        accountService,
        networkService,
        txSyncService: service,
        getProvider,
        scheduler: context.scheduler,
        now: context.now,
        logger: context.logger,
        globalConcurrency,
        highPriorityPollIntervalMs,
        backgroundPollIntervalMs,
        scanIntervalMs,
      }),
    );
  },

  start: ({ container }) => {
    if (!container.isBound(TxSyncScheduler)) return;
    container.get(TxSyncScheduler).start();
  },

  stop: ({ container }) => {
    if (!container.isBound(TxSyncScheduler)) return;
    container.get(TxSyncScheduler).stop();
  },
};
