/* eslint-disable @typescript-eslint/ban-types */
import { combineLatest, filter, debounceTime, distinctUntilChanged, interval, switchMap, takeUntil, Subject, of, startWith, type Subscription } from 'rxjs';
import { isEqual } from 'lodash-es';
import { type Plugin } from '../../Plugins';
import { NetworkType, ChainType } from './../../../database/models/Network';
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
import { fetchESpaceServer } from './fetchers/eSpaceServer';
import { queryNetworkById } from '../../../database/models/Network/query';
import { queryAddressById } from '../../../database/models/Address/query';
import trackAssets from './trackAssets';
import { type FetchAssetBalance, type AssetInfo, type Fetcher } from './types';
import { getAssetsHash, setAssetsHash, getAssetsSortedKeys, setAssetsSortedKeys, getAssetsAtomKey } from '../ReactInject/data/useAssets';

const compareNetworkAndAddress = ([prevNetwork, prevAddress]: [Network, Address], [currentNetwork, currentAddress]: [Network, Address]) => {
  return prevNetwork.id === currentNetwork.id && prevAddress.id === currentAddress.id;
};

export const getFetcherKey = ({ networkType, chainId }: { networkType: NetworkType; chainId?: string }) => {
  return typeof chainId === 'undefined' ? networkType : `${networkType}-${chainId}`;
};

class AssetsTrackerPlugin implements Plugin {
  public name = 'AssetsTracker';
  fetcherMap = new Map<string, Fetcher>();
  private cancel$ = new Subject<void>();
  private currentSubscription?: Subscription;

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
        fetchAssetsBalanceBatch: (params: Parameters<FetchAssetBalance>[0]) => fetchAssetsBalanceBatch({ ...params, networkType: NetworkType.Conflux }),
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
        debounceTime(88),
        distinctUntilChanged(compareNetworkAndAddress)
      )
      .subscribe(([network, address]) => {
        this.disposeCurrentSubscription();
        this.cancel$ = new Subject<void>();

        setTimeout(async () => {
          try {
            /** This subscribe may be triggered after resetData. */
            const isNetworkExist = !!network?.id && !!(await queryNetworkById(network.id));
            const isAddressExist = !!address?.id && !!(await queryAddressById(address.id));
            if (!isNetworkExist || !isAddressExist) return;

            const chainFetcher = this.fetcherMap.get(getFetcherKey({ networkType: network.networkType, chainId: network.chainId }));
            const networkFetcher = this.fetcherMap.get(getFetcherKey({ networkType: network.networkType }));
            if (!networkFetcher && !chainFetcher) return;

            const nativeAsset = (await network.nativeAssetQuery.fetch())?.[0];
            const assetsHash: Record<string, AssetInfo> = {};
            const assetsSortedKeys: Array<string> = [];
            const assetsAtomKey = getAssetsAtomKey({ network, address });

            this.currentSubscription = interval(8888)
              .pipe(
                startWith(0),
                switchMap(() => trackAssets({ chainFetcher, networkFetcher, nativeAsset, network, address, assetsHash, assetsSortedKeys })),
                takeUntil(this.cancel$)
              )
              .subscribe({
                next: () => {
                  const assetsHashInAtom = getAssetsHash(assetsAtomKey);
                  const assetsSortedKeysInAtom = getAssetsSortedKeys(assetsAtomKey);

                  if (!isEqual(assetsSortedKeys, assetsSortedKeysInAtom)) {
                    setAssetsSortedKeys(assetsAtomKey, [...assetsSortedKeys]);
                  }
                  if (!isEqual(assetsHashInAtom, assetsHash)) {
                    setAssetsHash(assetsAtomKey, { ...assetsHash });
                  }
                },
                error: (error) => console.error(`Error in trackAssets(network-${network.name} address-${address.hex}):`, error),
                complete: () => console.log(`trackAssets(network-${network.name} address-${address.hex}) completed or canceled`),
              });
          } catch (_) {
            // console.log()
          }
        }, 60);
      });
  }

  private disposeCurrentSubscription = () => {
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = undefined;
  };

  cancelCurrentTracker = () => {
    this.cancel$.next();
    this.disposeCurrentSubscription();
  };
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
