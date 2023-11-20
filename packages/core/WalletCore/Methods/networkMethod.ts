import { injectable } from 'inversify';
import { type Network } from '../../database/models/Network';
import { createNetwork, querySelectedNetwork } from '../../database/models/Network/query';
import database from '../../database';
import TableName from '../../database/TableName';

@injectable()
export class NetworkMethod {
  createNetwork = createNetwork;

  async switchToNetwork(targetNetworkOrId: Network | string) {
    const targetNetwork =
      typeof targetNetworkOrId === 'string' ? ((await database.get(TableName.Network).find(targetNetworkOrId)) as Network) : targetNetworkOrId;
    if (!targetNetwork) throw new Error('Network not found.');

    return database.write(async () => {
      if (targetNetwork.selected) return;
      const selectedNetwork = await querySelectedNetwork();
      const updates = selectedNetwork
        .map((network) =>
          network.prepareUpdate((_network) => {
            _network.selected = false;
          })
        )
        .concat(
          targetNetwork.prepareUpdate((_network) => {
            _network.selected = true;
          })
        );
      return database.batch(...updates);
    });
  }
}
