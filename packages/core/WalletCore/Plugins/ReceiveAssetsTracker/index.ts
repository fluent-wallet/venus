import { NetworkType } from './../../../database/models/Network';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '../../../consts/network';
import events from '../../Events';
import { AssetSource, type Asset } from '../../../database/models/Asset';
import { type AssetInfo } from '../../Plugins/AssetsTracker/types';
import { type Plugin } from '../../Plugins';
import { fetchReceiveAssets as fetchESpaceReceiveAssets } from './fetchers/eSpace';
import methods from '../../Methods';
import database from '../../../database';
import { convertToChecksum } from '../../../utils/account';

type Fetcher = (endpoint: string) => Promise<AssetInfo[]>;

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    ReceiveAssetsTracker: ReceiveAssetsTrackerPluginClass;
  }
}

const getFetcherKey = ({ networkType, chainId }: { networkType: NetworkType; chainId: string }) => `${networkType}-${chainId}`;

class ReceiveAssetsTrackerPluginClass implements Plugin {
  public name = 'ReceiveAssetsTracker';
  private fetcherMap = new Map<string, Fetcher>();

  constructor() {
    this.register({
      networkType: NetworkType.Ethereum,
      chainId: CFX_ESPACE_TESTNET_CHAINID,
      fetcher: (endpoint: string) => fetchESpaceReceiveAssets({ endpoint, isTestnet: true }),
    });
    this.register({
      networkType: NetworkType.Ethereum,
      chainId: CFX_ESPACE_MAINNET_CHAINID,
      fetcher: (endpoint: string) => fetchESpaceReceiveAssets({ endpoint, isTestnet: false }),
    });
    this.setup();
  }

  register({ networkType, chainId, fetcher }: { networkType: NetworkType; chainId: string; fetcher: Fetcher }) {
    if (!networkType || !chainId) {
      throw new Error('networkType and chainId is required');
    }
    this.fetcherMap.set(getFetcherKey({ networkType, chainId }), fetcher);
  }

  private setup() {
    events.currentNetworkChangedSubject.subscribe((network) => {
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

export default new ReceiveAssetsTrackerPluginClass();
