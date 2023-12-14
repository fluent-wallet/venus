/* eslint-disable @typescript-eslint/ban-types */
import { combineLatest, filter, debounceTime, distinctUntilChanged, of, catchError, mergeMap, from, Observable } from 'rxjs';
import { type Plugin } from '../../Plugins';
import { NetworkType, ChainType } from './../../../database/models/Network';
import { AssetType } from './../../../database/models/Asset';
import { type Address } from './../../../database/models/Address';
import { type Network } from './../../../database/models/Network';
import { fetchAssetsBalance, fetchAssetsBalanceBatch, fetchAssetsBalanceMulticall } from './fetchers/basic';
import {
  CFX_MAINNET_RPC_ENDPOINT,
  CFX_MAINNET_CHAINID,
  CFX_ESPACE_MAINNET_RPC_ENDPOINT,
  CFX_ESPACE_MAINNET_CHAINID,
  CFX_ESPACE_TESTNET_RPC_ENDPOINT,
  CFX_ESPACE_TESTNET_CHAINID,
  CFX_TESTNET_RPC_ENDPOINT,
  CFX_TESTNET_CHAINID,
} from '../../../consts/network';
import events from '../../Events';
import { setAssets } from '../ReactInject/data/useAssets';
import { fetchESpaceServer } from './fetchers/eSpaceServer';
import { queryNetworkById } from '../../../database/models/Network/query';
import { queryAddressById } from '../../../database/models/Address/query';

const compareNetworkAndAddress = ([prevNetwork, prevAddress]: [Network, Address], [currentNetwork, currentAddress]: [Network, Address]) => {
  return prevNetwork.id === currentNetwork.id && prevAddress.id === currentAddress.id;
};

export const getFetcherKey = ({ networkType, chainId }: { networkType: NetworkType; chainId?: string }) => {
  return typeof chainId === 'undefined' ? networkType : `${networkType}-${chainId}`;
};

type FetchAssetBalance = (params: {
  endpoint: string;
  account: string;
  assets: Array<{
    contractAddress?: string;
    assetType?: Omit<AssetType, AssetType.ERC1155>;
  }>;
}) => Promise<Array<string>>;

export interface AssetWithBalance {
  assetInfo: { contractAddress: string; name: string; symbol: string; decimals: number };
  balance: string;
}

interface Fetcher {
  fetchAssetsBalance?: FetchAssetBalance;
  fetchAssetsBalanceBatch?: FetchAssetBalance;
  fetchAssetsBalanceMulticall?: FetchAssetBalance;
  fetchFromServer?: (params: { address: Address; network: Network }) => Promise<Array<AssetWithBalance>>;
}
const priorityFetcher = ['fetchAssetsBalanceMulticall', 'fetchAssetsBalanceBatch', 'fetchAssetsBalance'] as const;

class AssetsTrackerPlugin implements Plugin {
  public name = 'AssetsTracker';
  fetcherMap = new Map<string, Fetcher>();
  constructor() {
    this.register({
      networkType: NetworkType.Ethereum,
      fetcher: {
        fetchAssetsBalance: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalance({ ...params, networkType: NetworkType.Ethereum }),
        fetchAssetsBalanceBatch: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalanceBatch({ ...params, networkType: NetworkType.Ethereum }),
      },
    });
    this.register({
      networkType: NetworkType.Conflux,
      fetcher: {
        fetchAssetsBalance: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalance({ ...params, networkType: NetworkType.Conflux }),
        fetchAssetsBalanceBatch: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalanceBatch({ ...params, networkType: NetworkType.Ethereum }),
      },
    });
    this.register({
      networkType: NetworkType.Ethereum,
      chainId: CFX_ESPACE_TESTNET_CHAINID,
      fetcher: {
        fetchAssetsBalanceMulticall: (params: Parameters<FetchAssetBalance>[0]) =>
          fetchAssetsBalanceMulticall({ ...params, networkType: NetworkType.Ethereum, multicallContractAddress: '0xd59149a01f910c3c448e41718134baeae55fa784' }),
      },
    });
    this.register({
      networkType: NetworkType.Ethereum,
      chainId: CFX_ESPACE_MAINNET_CHAINID,
      fetcher: {
        fetchAssetsBalanceMulticall: (params: Parameters<FetchAssetBalance>[0]) =>
          fetchAssetsBalanceMulticall({ ...params, networkType: NetworkType.Ethereum, multicallContractAddress: '0x9f208d7226f05b4f43d0d36eb21d8545c3143685' }),
      },
    });

    this.setup();
  }

  register({ networkType, chainId, fetcher }: { networkType: NetworkType; chainId?: string; fetcher: Fetcher }) {
    if (!networkType && !chainId) {
      throw new Error('networkType or string is required');
    }
    const existFetcher = this.fetcherMap.get(getFetcherKey({ networkType, chainId })) ?? (Object.create(null) as Fetcher);
    Object.assign(existFetcher, fetcher);
    this.fetcherMap.set(getFetcherKey({ networkType, chainId }), existFetcher);
  }

  private setup() {
    combineLatest([events.currentNetworkObservable, events.currentAddressObservable])
      .pipe(
        filter((tuple): tuple is [Network, Address] => tuple.every((ele) => !!ele)),
        debounceTime(200),
        distinctUntilChanged(compareNetworkAndAddress)
      )
      .subscribe(([network, address]) => {
        const assetsHash: Record<string, AssetWithBalance> = {};
        setTimeout(async () => {
          try {
            const isNetworkExist = !!network?.id && !!(await queryNetworkById(network.id));
            const isAddressExist = !!address?.id && !!(await queryAddressById(address.id));
            if (!isNetworkExist || !isAddressExist) return;
            const chainFetcher = this.fetcherMap.get(getFetcherKey({ networkType: network.networkType, chainId: network.chainId }));
            const networkFetcher = this.fetcherMap.get(getFetcherKey({ networkType: network.networkType }));
            if (chainFetcher && typeof chainFetcher.fetchFromServer === 'function') {
              const assetsWithBalance = await chainFetcher.fetchFromServer({ address, network });
              assetsWithBalance?.forEach((asset) => (assetsHash[asset.assetInfo.contractAddress || AssetType.Native] = asset));
            }

            const currentAssetRule = await address.assetRule;
            const assetsInRule = await currentAssetRule.assets;
            const assetsNeedFetch = assetsInRule.filter((asset) => !assetsHash[asset.contractAddress || AssetType.Native]);
            if (assetsNeedFetch.length) {
              const fetchers: Array<FetchAssetBalance> = [];
              for (const name of priorityFetcher) {
                if (chainFetcher && chainFetcher?.[name] && !fetchers.some((m) => m.name === name)) {
                  fetchers.push(chainFetcher[name]!);
                }

                if (networkFetcher && networkFetcher?.[name] && !fetchers.some((m) => m.name === name)) {
                  fetchers.push(networkFetcher[name]!);
                }
              }
              const fallbackFetch = (_fetchers: Array<FetchAssetBalance>) => {
                if (_fetchers.length === 0) {
                  throw new Error('No fallback');
                }

                const fetchAssetBalances = _fetchers[0];

                return new Observable((observer) => {
                  of(
                    fetchAssetBalances({
                      endpoint: network.endpoint,
                      account: address.hex,
                      assets: assetsNeedFetch.map((asset) => ({ assetType: asset.type, contractAddress: asset.contractAddress })),
                    })
                  )
                    .pipe(
                      mergeMap((result) => from(result)),
                      catchError(() => fallbackFetch(_fetchers.slice(1)))
                    )
                    .subscribe({
                      next: (res) => observer.next(res),
                      error: (err) => observer.error(err),
                    });
                });
              };

              fallbackFetch(fetchers).subscribe({
                next: (result) => {
                  const balancesResult = result as Array<string>;
                  const assetsWithBalance: Array<AssetWithBalance> = balancesResult.map((balance, index) => ({
                    assetInfo: {
                      name: assetsNeedFetch[index].name!,
                      symbol: assetsNeedFetch[index].symbol!,
                      decimals: assetsNeedFetch[index].decimals!,
                      contractAddress: assetsNeedFetch[index].contractAddress!,
                    },
                    balance,
                  }));
                  assetsWithBalance?.forEach((asset) => (assetsHash[asset.assetInfo.contractAddress || AssetType.Native] = asset));

                  console.log('fallbackFetch success', assetsHash);
                },
                error: (err) => {
                  console.log('fallbackFetch err', err);
                },
              });
            }
          } catch (_) {}
        }, 20);
      });
  }
}

const assetsTracker = new AssetsTrackerPlugin();

assetsTracker.register({
  networkType: NetworkType.Ethereum,
  chainId: CFX_ESPACE_TESTNET_CHAINID,
  fetcher: {
    fetchFromServer: ({ address, network }) => fetchESpaceServer({ hexAddress: address.hex, chainType: ChainType.Testnet, network }),
  },
});

export default assetsTracker;
