import type { Database } from '@core/database';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import type { INetwork, NetworkEndpointEntry } from './types';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';

@injectable()
export class NetworkService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(CORE_IDENTIFIERS.EVENT_BUS)
  @optional()
  private readonly eventBus?: EventBus<CoreEventMap>;

  async getAllNetworks(): Promise<INetwork[]> {
    const networks = await this.database.get<Network>(TableName.Network).query().fetch();
    return networks.map((network) => this.toInterface(network));
  }

  async getCurrentNetwork(): Promise<INetwork> {
    let selected = await this.getSelectedNetworkModel();
    if (!selected) {
      const fallback = await this.chooseFallbackNetwork();

      await this.database.write(async () => {
        await fallback.update((record) => {
          record.selected = true;
        });
      });

      selected = fallback;
    }

    return this.toInterface(selected);
  }

  async switchNetwork(networkId: string): Promise<void> {
    const target = await this.findNetworkOrThrow(networkId);

    if (target.selected) {
      return;
    }

    await this.database.write(async () => {
      const currentlySelected = await this.database.get<Network>(TableName.Network).query(Q.where('selected', true)).fetch();

      const operations = [
        ...currentlySelected.map((network) =>
          network.prepareUpdate((record) => {
            record.selected = false;
          }),
        ),
        target.prepareUpdate((record) => {
          record.selected = true;
        }),
      ];

      if (operations.length > 0) {
        await this.database.batch(...operations);
      }
    });
    const network = await this.getCurrentNetwork();
    this.eventBus?.emit('network/current-changed', { network });
  }

  private async getSelectedNetworkModel(): Promise<Network | null> {
    const networks = await this.database.get<Network>(TableName.Network).query(Q.where('selected', true)).fetch();

    return networks[0] ?? null;
  }

  private async chooseFallbackNetwork(): Promise<Network> {
    const networks = await this.database.get<Network>(TableName.Network).query().fetch();

    if (!networks.length) {
      throw new Error('No networks configured.');
    }

    const builtin = networks.find((network) => network.builtin);
    return builtin ?? networks[0];
  }

  private async findNetworkOrThrow(networkId: string): Promise<Network> {
    try {
      return await this.database.get<Network>(TableName.Network).find(networkId);
    } catch {
      throw new Error(`Network ${networkId} not found.`);
    }
  }

  async updateEndpoint(networkId: string, endpoint: string): Promise<void> {
    const network = await this.findNetworkOrThrow(networkId);
    await network.updateEndpoint(endpoint);
  }

  async addEndpoint(networkId: string, entry: NetworkEndpointEntry): Promise<boolean> {
    const network = await this.findNetworkOrThrow(networkId);
    return network.addEndpoint(entry);
  }

  async removeEndpoint(networkId: string, endpoint: string): Promise<boolean> {
    const network = await this.findNetworkOrThrow(networkId);
    return network.removeEndpoint(endpoint);
  }

  private toInterface(network: Network): INetwork {
    return {
      id: network.id,
      name: network.name,
      endpoint: network.endpoint,
      endpointsList: network.endpointsList,
      netId: network.netId,
      chainId: network.chainId,
      gasBuffer: network.gasBuffer,
      networkType: network.networkType,
      chainType: network.chainType,
      icon: network.icon,
      scanUrl: network.scanUrl,
      selected: network.selected,
      builtin: network.builtin,
    };
  }
}
