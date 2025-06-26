import type { IPlugin } from '@core/WalletCore/plugin';
import { Networks } from '../../../utils/consts';
import { NetworkType } from './../../../database/models/Network';
import { fetchReceiveAssets as fetchESpaceReceiveAssets } from './fetchers/eSpace';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { ReceiveAssetsTrackerServer } from './server';

export const ReceiveAssetsTrackerPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.RECEIVE_ASSETS_TRACKER,
  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.RECEIVE_ASSETS_TRACKER).to(ReceiveAssetsTrackerServer).inSingletonScope();
  },

  afterInstall(context) {
    const receiveAssetsTracker: ReceiveAssetsTrackerServer = context.container.get(SERVICE_IDENTIFIER.RECEIVE_ASSETS_TRACKER);
    receiveAssetsTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['eSpace Testnet'].chainId,
      fetcher: (endpoint: string) => fetchESpaceReceiveAssets({ endpoint, isTestnet: true }),
    });
    receiveAssetsTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['Conflux eSpace'].chainId,
      fetcher: (endpoint: string) => fetchESpaceReceiveAssets({ endpoint, isTestnet: false }),
    });
    receiveAssetsTracker.setup();
  },
};
