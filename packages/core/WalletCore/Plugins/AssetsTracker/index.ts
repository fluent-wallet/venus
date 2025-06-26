import { Networks } from '../../../utils/consts';
import { ChainType, NetworkType } from './../../../database/models/Network';
import { fetchAssetsBalance, fetchAssetsBalanceBatch, fetchAssetsBalanceMulticall } from './fetchers/basic';
import { fetchESpaceServer } from './fetchers/eSpaceServer';
import type { FetchAssetBalance } from './types';
import type { IPlugin } from '@core/WalletCore/plugin';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { AssetsTrackerServer } from './server';

export const AssetsTrackerPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.ASSETS_TRACKER,

  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.ASSETS_TRACKER).to(AssetsTrackerServer).inSingletonScope();
  },

  afterInstall(context) {
    const assetsTracker: AssetsTrackerServer = context.container.get(SERVICE_IDENTIFIER.ASSETS_TRACKER);

    assetsTracker.register({
      networkType: NetworkType.Ethereum,
      fetcher: {
        fetchAssetsBalance: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalance({ ...params, networkType: NetworkType.Ethereum }),
        fetchAssetsBalanceBatch: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalanceBatch({ ...params, networkType: NetworkType.Ethereum }),
      },
    });
    assetsTracker.register({
      networkType: NetworkType.Conflux,
      fetcher: {
        fetchAssetsBalance: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalance({ ...params, networkType: NetworkType.Conflux }),
        fetchAssetsBalanceBatch: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalanceBatch({ ...params, networkType: NetworkType.Conflux }),
      },
    });
    assetsTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['eSpace Testnet'].chainId,
      fetcher: {
        fetchAssetsBalanceMulticall: (params: Parameters<FetchAssetBalance>[0]) =>
          fetchAssetsBalanceMulticall({ ...params, networkType: NetworkType.Ethereum, multicallContractAddress: '0xd59149a01f910c3c448e41718134baeae55fa784' }),
      },
    });
    assetsTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['Conflux eSpace'].chainId,
      fetcher: {
        fetchAssetsBalanceMulticall: (params: Parameters<FetchAssetBalance>[0]) =>
          fetchAssetsBalanceMulticall({ ...params, networkType: NetworkType.Ethereum, multicallContractAddress: '0x9f208d7226f05b4f43d0d36eb21d8545c3143685' }),
      },
    });
    assetsTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['Ethereum Mainnet'].chainId,
      fetcher: {
        fetchAssetsBalanceMulticall: (params: Parameters<FetchAssetBalance>[0]) =>
          fetchAssetsBalanceMulticall({ ...params, networkType: NetworkType.Ethereum, multicallContractAddress: '0x5ba1e12693dc8f9c48aad8770482f4739beed696' }),
      },
    });
    assetsTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['Ethereum Sepolia'].chainId,
      fetcher: {
        fetchAssetsBalanceMulticall: (params: Parameters<FetchAssetBalance>[0]) =>
          fetchAssetsBalanceMulticall({ ...params, networkType: NetworkType.Ethereum, multicallContractAddress: '0x25Eef291876194AeFAd0D60Dff89e268b90754Bb' }),
      },
    });

    assetsTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['eSpace Testnet'].chainId,
      fetcher: {
        fetchFromServer: ({ address, network }) => fetchESpaceServer({ hexAddress: address.hex, chainType: ChainType.Testnet, network }),
      },
    });

    assetsTracker.register({
      networkType: NetworkType.Ethereum,
      chainId: Networks['Conflux eSpace'].chainId,
      fetcher: {
        fetchFromServer: ({ address, network }) => fetchESpaceServer({ hexAddress: address.hex, chainType: ChainType.Mainnet, network }),
      },
    });
    assetsTracker.setup();
  },
};
