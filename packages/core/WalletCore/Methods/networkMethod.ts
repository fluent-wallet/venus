import { injectable } from 'inversify';
import { type Network } from '../../database/models/Network';
import { createNetwork, querySelectedNetwork, queryNetworkById, queryNetworkByChainId, queryNetworkByNetId } from '../../database/models/Network/query';
import database from '../../database';

@injectable()
export class NetworkMethod {
  createNetwork = createNetwork;

  async switchToNetwork(targetNetworkOrIdOrChainIdorNetId: Network | string | number) {
    let targetNetwork: Network | undefined;
    if (typeof targetNetworkOrIdOrChainIdorNetId === 'string') {
      targetNetwork = await queryNetworkById(targetNetworkOrIdOrChainIdorNetId);
      if (!targetNetwork) targetNetwork = await queryNetworkByChainId(targetNetworkOrIdOrChainIdorNetId);
    } else if (typeof targetNetworkOrIdOrChainIdorNetId === 'number') {
      targetNetwork = await queryNetworkByNetId(targetNetworkOrIdOrChainIdorNetId);
    } else {
      targetNetwork = targetNetworkOrIdOrChainIdorNetId;
    }

    if (!targetNetwork) throw new Error('Network not found.');

    return database.write(async () => {
      if (targetNetwork!.selected) return;
      const selectedNetwork = await querySelectedNetwork();
      const updates = selectedNetwork
        .map((network) =>
          network.prepareUpdate((_network) => {
            _network.selected = false;
          })
        )
        .concat(
          targetNetwork!.prepareUpdate((_network) => {
            _network.selected = true;
          })
        );
      return database.batch(...updates);
    });
  }
}
