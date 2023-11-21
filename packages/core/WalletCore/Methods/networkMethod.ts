import { injectable } from 'inversify';
import { type Network } from '../../database/models/Network';
import { createNetwork, querySelectedNetwork, queryNetworkById, queryNetworkByChainId, queryNetworkByNetId } from '../../database/models/Network/query';
import database from '../../database';

@injectable()
export class NetworkMethod {
  createNetwork = createNetwork;

  async switchToNetwork(targetNetworkOrIdOrChainIdOrNetId: Network | string | number) {
    let targetNetwork: Network | undefined;
    if (typeof targetNetworkOrIdOrChainIdOrNetId === 'string') {
      targetNetwork = await queryNetworkById(targetNetworkOrIdOrChainIdOrNetId);
      if (!targetNetwork) targetNetwork = await queryNetworkByChainId(targetNetworkOrIdOrChainIdOrNetId);
    } else if (typeof targetNetworkOrIdOrChainIdOrNetId === 'number') {
      targetNetwork = await queryNetworkByNetId(targetNetworkOrIdOrChainIdOrNetId);
    } else {
      targetNetwork = targetNetworkOrIdOrChainIdOrNetId;
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
      return await database.batch(...updates);
    });
  }
}
