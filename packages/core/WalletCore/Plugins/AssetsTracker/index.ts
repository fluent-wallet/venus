/* eslint-disable @typescript-eslint/ban-types */
import { interval, switchMap, takeUntil, Subject, startWith, type Subscription } from 'rxjs';
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
import {
  getAssetsHash,
  setAssetsHash,
  getAssetsSortedKeys,
  setAssetsSortedKeys,
  getAssetsAtomKey,
  setAssetsInFetch,
  getAssetsInFetch,
} from '../ReactInject/data/useAssets';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    AssetsTracker: AssetsTrackerPluginClass;
  }
}

export const getFetcherKey = ({ networkType, chainId }: { networkType: NetworkType; chainId?: string }) => {
  return typeof chainId === 'undefined' ? networkType : `${networkType}-${chainId}`;
};

class AssetsTrackerPluginClass implements Plugin {
  public name = 'AssetsTracker';
  private fetcherMap = new Map<string, Fetcher>();
  private cancel$: Subject<void> | null = null;
  private currentSubscription?: Subscription;
  private currentNetwork: Network | undefined;
  private currentAddress: Address | undefined;

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
      throw new Error('networkType or chainId is required');
    }
    const existFetcher = this.fetcherMap.get(getFetcherKey({ networkType, chainId })) ?? (Object.create(null) as Fetcher);
    Object.assign(existFetcher, fetcher);
    this.fetcherMap.set(getFetcherKey({ networkType, chainId }), existFetcher);
  }

  private setup() {
    events.combineNetworkAndAddressChangedSubject.subscribe(([network, address]) => {
      this.currentNetwork = network;
      this.currentAddress = address;

      this.startPolling({ network, address });
    });
  }

  /** This function immediately start a tracker for the current network assets and returns a Promise that resolves when first fetchAssets success. */
  private startPolling = async ({ network, address }: { network: Network; address: Address }, forceUpdate = false) => {
    if (!forceUpdate) {
      this.disposeCurrentSubscription();
    } else {
      this.cancelCurrentTracker();
    }

    this.cancel$ = new Subject<void>();

    let resolve!: (value: boolean | PromiseLike<boolean>) => void, reject!: (reason?: any) => void;
    const firstFetchPromise = new Promise<boolean>((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    try {
      /** This subscribe may be triggered after resetData. */
      if (!forceUpdate) {
        const isNetworkExist = !!network?.id && !!(await queryNetworkById(network.id));
        const isAddressExist = !!address?.id && !!(await queryAddressById(address.id));
        if (!isNetworkExist || !isAddressExist) return;
      }

      const chainFetcher = this.fetcherMap.get(getFetcherKey({ networkType: network.networkType, chainId: network.chainId }));
      const networkFetcher = this.fetcherMap.get(getFetcherKey({ networkType: network.networkType }));
      if (!networkFetcher && !chainFetcher) return;

      const nativeAsset = (await network.nativeAssetQuery.fetch())?.[0];
      const assetsAtomKey = getAssetsAtomKey({ network, address });

      this.currentSubscription = interval(8888)
        .pipe(
          startWith(0),
          switchMap(() => {
            if (forceUpdate) {
              setAssetsInFetch(assetsAtomKey, true);
            }
            return trackAssets({ chainFetcher, networkFetcher, nativeAsset, network, address });
          }),
          takeUntil(this.cancel$!),
        )
        .subscribe({
          next: (trackRes) => {
            const { assetsHash, assetsSortedKeys } = trackRes;
            const assetsHashInAtom = getAssetsHash(assetsAtomKey);
            const assetsSortedKeysInAtom = getAssetsSortedKeys(assetsAtomKey);

            if (!isEqual(assetsSortedKeys, assetsSortedKeysInAtom)) {
              setAssetsSortedKeys(assetsAtomKey, [...assetsSortedKeys]);
            }
            if (!isEqual(assetsHashInAtom, assetsHash)) {
              setAssetsHash(assetsAtomKey, { ...assetsHash });
            }
            resolve(true);
            if (getAssetsInFetch(assetsAtomKey)) {
              setAssetsInFetch(assetsAtomKey, false);
            }
          },
          error: (error) => {
            // console.log(`Error in trackAssets(network-${network.name} address-${address.hex}):`, error);
            reject(false);
            if (getAssetsInFetch(assetsAtomKey)) {
              setAssetsInFetch(assetsAtomKey, false);
            }
          },
          complete: () => {
            // console.log(`trackAssets(network-${network.name} address-${address.hex}) completed or canceled`);
            reject(false);
            if (getAssetsInFetch(assetsAtomKey)) {
              setAssetsInFetch(assetsAtomKey, false);
            }
          },
        });
    } catch (_) {
      // console.log()
      reject(false);
    }

    return firstFetchPromise;
  };

  private disposeCurrentSubscription = () => {
    this.currentSubscription?.unsubscribe();
    this.currentSubscription = undefined;
  };

  public cancelCurrentTracker = () => {
    this.cancel$?.next();
    this.disposeCurrentSubscription();
    this.cancel$ = null;
  };

  public updateCurrentTracker = async () => this.startPolling({ network: this.currentNetwork!, address: this.currentAddress! }, true);
}

const assetsTracker = new AssetsTrackerPluginClass();

assetsTracker.register({
  networkType: NetworkType.Ethereum,
  chainId: CFX_ESPACE_TESTNET_CHAINID,
  fetcher: {
    fetchFromServer: ({ address, network }) => fetchESpaceServer({ hexAddress: address.hex, chainType: ChainType.Testnet, network }),
  },
});

assetsTracker.register({
  networkType: NetworkType.Ethereum,
  chainId: CFX_ESPACE_MAINNET_CHAINID,
  fetcher: {
    fetchFromServer: ({ address, network }) => fetchESpaceServer({ hexAddress: address.hex, chainType: ChainType.Mainnet, network }),
  },
});

export default assetsTracker;
