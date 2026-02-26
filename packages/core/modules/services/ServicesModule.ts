import { ChainRegistry, ConfluxChainProvider, EthereumChainProvider } from '@core/chains';
import { EndpointManager } from '@core/chains/EndpointManager';
import type { Database } from '@core/database';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { registerDefaultHardwareWallets } from '@core/hardware';
import type { RuntimeModule } from '@core/runtime/types';
import { registerServices } from '@core/services';
import { VaultService } from '@core/services/vault';
import { NetworkType } from '@core/types';
import { injectable } from 'inversify';
import type { CoreEventMap, EventBus, Subscription } from '../eventBus';
import { CRYPTO_TOOL_MODULE_ID, DB_BOOTSTRAP_MODULE_ID, DB_MODULE_ID, EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID } from '../ids';

@injectable()
class ServicesModuleState {
  networkChangedSub: Subscription | null = null;
  chainKeyToNetworkId = new Map<string, string>();
}

export const ServicesModule: RuntimeModule = {
  id: SERVICES_MODULE_ID,
  dependencies: [DB_MODULE_ID, DB_BOOTSTRAP_MODULE_ID, CRYPTO_TOOL_MODULE_ID, EVENT_BUS_MODULE_ID],
  register: ({ container, config }) => {
    if (!container.isBound(CORE_IDENTIFIERS.CONFIG)) {
      container.bind(CORE_IDENTIFIERS.CONFIG).toConstantValue(config);
    }

    if (!container.isBound(ServicesModuleState)) {
      container.bind(ServicesModuleState).toSelf().inSingletonScope();
    }

    if (container.isBound(VaultService)) return;
    registerServices(container);
  },

  start: async ({ container, logger }) => {
    const db = container.get<Database>(CORE_IDENTIFIERS.DB);
    const chainRegistry = container.get(ChainRegistry);
    const endpointManager = container.get(EndpointManager);
    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
    const state = container.get(ServicesModuleState);

    try {
      registerDefaultHardwareWallets({ container, registerBSIM: true });
    } catch (error) {
      logger.warn('ServicesModule:register-default-hardware-wallets:failed', { error });
    }

    const networks = await db.get<Network>(TableName.Network).query().fetch();
    if (networks.length === 0) return;

    for (const network of networks) {
      if (!network.endpoint) continue;
      endpointManager.setEndpoint(network.id, network.endpoint);
    }

    state.networkChangedSub?.unsubscribe();
    state.networkChangedSub = eventBus.on('network/current-changed', ({ network }) => {
      if (!network?.id || !network.endpoint) return;

      endpointManager.setEndpoint(network.id, network.endpoint);

      const chainKey = `${String(network.networkType)}:${String(network.chainId).toLowerCase()}`;
      const registeredNetworkId = state.chainKeyToNetworkId.get(chainKey);

      if (registeredNetworkId && registeredNetworkId !== network.id) {
        endpointManager.setEndpoint(registeredNetworkId, network.endpoint);
        logger.warn('ServicesModule:duplicate-network-same-chain-key', {
          chainKey,
          registeredNetworkId,
          currentNetworkId: network.id,
        });
      }
    });

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
              networkId: selected.id,
              endpointManager,
            }),
          );
        } else if (selected.networkType === NetworkType.Conflux) {
          chainRegistry.register(
            new ConfluxChainProvider({
              chainId: selected.chainId,
              netId: selected.netId,
              networkId: selected.id,
              endpointManager,
            }),
          );
        } else {
          continue;
        }

        state.chainKeyToNetworkId.set(key, selected.id);

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
  stop: ({ container }) => {
    if (!container.isBound(ServicesModuleState)) return;

    const state = container.get(ServicesModuleState);
    state.networkChangedSub?.unsubscribe();
    state.networkChangedSub = null;
  },
};
