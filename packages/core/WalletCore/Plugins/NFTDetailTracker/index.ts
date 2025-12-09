import type { IPlugin } from '@core/WalletCore/plugin';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { NetworkType } from './../../../database/models/Network';
import { Networks } from '../../../utils/consts';
import { fetchNFTDetail as fetchESpaceNFTDetail } from './fetchers/eSpace';
import { type FetcherParams, NFTDetailTrackerServer } from './server';

export const NFTDetailTrackerPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.NFT_DETAIL_TRACKER,

  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.NFT_DETAIL_TRACKER).to(NFTDetailTrackerServer).inSingletonScope();
  },

  afterInstall(context) {
    const nftDetailTracker: NFTDetailTrackerServer = context.container.get(SERVICE_IDENTIFIER.NFT_DETAIL_TRACKER);
    nftDetailTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['eSpace Testnet'].chainId,
      fetcher: (params: FetcherParams) => fetchESpaceNFTDetail({ ...params, isTestnet: true }),
    });
    nftDetailTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['Conflux eSpace'].chainId,
      fetcher: (params: FetcherParams) => fetchESpaceNFTDetail({ ...params, isTestnet: false }),
    });

    nftDetailTracker.setup();
  },
};
