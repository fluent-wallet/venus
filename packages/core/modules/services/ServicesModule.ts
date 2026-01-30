import { ChainRegistry, ConfluxChainProvider, EthereumChainProvider } from '@core/chains';
import type { Database } from '@core/database';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeModule } from '@core/runtime/types';
import { registerServices } from '@core/services';
import { VaultService } from '@core/services/vault';
import { NetworkType } from '@core/types';
import { CRYPTO_TOOL_MODULE_ID, DB_BOOTSTRAP_MODULE_ID, DB_MODULE_ID, EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID } from '../ids';

export const ServicesModule: RuntimeModule = {
  id: SERVICES_MODULE_ID,
  dependencies: [DB_MODULE_ID, DB_BOOTSTRAP_MODULE_ID, CRYPTO_TOOL_MODULE_ID, EVENT_BUS_MODULE_ID],
  register: ({ container }) => {
    if (container.isBound(VaultService)) return;
    registerServices(container);
  },

  start: async ({ container, logger }) => {
    const db = container.get<Database>(CORE_IDENTIFIERS.DB);
    const chainRegistry = container.get(ChainRegistry);

    const networks = await db.get<Network>(TableName.Network).query().fetch();
    if (networks.length === 0) return;

    const byKey = new Map<string, Network[]>();
    for (const network of networks) {
      const key = `${String(network.networkType)}:${network.chainId.toLowerCase()}`;
      const list = byKey.get(key);
      if (list) list.push(network);
      else byKey.set(key, [network]);
    }

    for (const [key, group] of byKey.entries()) {
      const selected = group.find((n) => n.selected) ?? group[0];
      if (!selected) continue;

      if (chainRegistry.has(selected.chainId, selected.networkType)) {
        continue;
      }

      if (group.length > 1) {
        logger.warn('ServicesModule:multiple-networks-same-chain', {
          key,
          selectedNetworkId: selected.id,
          networkIds: group.map((n) => n.id),
        });
      }

      try {
        if (selected.networkType === NetworkType.Ethereum) {
          chainRegistry.register(
            new EthereumChainProvider({
              chainId: selected.chainId,
              endpoint: selected.endpoint,
            }),
          );
        } else if (selected.networkType === NetworkType.Conflux) {
          chainRegistry.register(
            new ConfluxChainProvider({
              chainId: selected.chainId,
              endpoint: selected.endpoint,
              netId: selected.netId,
            }),
          );
        } else {
          continue;
        }

        logger.info('ServicesModule:chain-provider-registered', {
          chainId: selected.chainId,
          networkType: selected.networkType,
          networkId: selected.id,
        });
      } catch (error) {
        logger.warn('ServicesModule:chain-provider-register-failed', {
          chainId: selected.chainId,
          networkType: selected.networkType,
          networkId: selected.id,
          error,
        });
      }
    }
  },
};
