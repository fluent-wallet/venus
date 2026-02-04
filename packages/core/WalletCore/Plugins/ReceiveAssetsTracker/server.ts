import { CURRENT_NETWORK_CHANGED_EVENT, type EventBus } from '@core/WalletCore/Events';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { inject, injectable } from 'inversify';
import database from '../../../database';
import { type Asset, AssetSource } from '../../../database/models/Asset';
import type { NetworkType } from './../../../database/models/Network';
import { convertToChecksum } from '../../../utils/account';
import methods from '../../Methods';
import type { AssetInfo } from '../../Plugins/AssetsTracker/types';

export type Fetcher = (endpoint: string) => Promise<AssetInfo[]>;

const getFetcherKey = ({ networkType, chainId }: { networkType: NetworkType; chainId: string }) => `${networkType}-${chainId}`;

@injectable()
export class ReceiveAssetsTrackerServer {
  private fetcherMap = new Map<string, Fetcher>();

  @inject(SERVICE_IDENTIFIER.EVENT_BUS)
  eventBus!: EventBus;

  register({ networkType, chainId, fetcher }: { networkType: NetworkType; chainId: string; fetcher: Fetcher }) {
    if (!networkType || !chainId) {
      throw new Error('networkType and chainId is required');
    }
    this.fetcherMap.set(getFetcherKey({ networkType, chainId }), fetcher);
  }

  setup() {
    this.eventBus.on(CURRENT_NETWORK_CHANGED_EVENT).subscribe((network) => {
      if (!network) return;
      const fetcher = this.fetcherMap.get(getFetcherKey({ networkType: network.networkType, chainId: network.chainId }));
      if (!fetcher) return;

      fetcher(network.endpoint).then(async (assets) => {
        if (!Array.isArray(assets)) return;
        const assetsInDB = await network.assets;
        const assetsNotInDB = assets.filter(
          (asset) => !assetsInDB.find((dbAsset) => convertToChecksum(dbAsset.contractAddress) === convertToChecksum(asset.contractAddress)),
        );

        const preCreate: Array<Asset> = [];
        assetsNotInDB.forEach((assetInfo) => {
          preCreate.push(
            methods.createAsset(
              {
                network,
                ...assetInfo,
                source: AssetSource.Official,
              },
              true,
            ),
          );
        });
        if (preCreate.length > 0) {
          database.write(async () => {
            await database.batch(...preCreate);
          });
        }
      });
    });
  }
}
