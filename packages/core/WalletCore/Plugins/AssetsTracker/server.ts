import { CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT, type EventBus } from '@core/WalletCore/Events';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { inject, injectable } from 'inversify';
import { isEqual } from 'lodash-es';
import { catchError, from, interval, of, Subject, type Subscription, startWith, switchMap, takeUntil } from 'rxjs';
import type { Address } from './../../../database/models/Address';
import { queryAddressById } from '../../../database/models/Address/query';
import type { Network, NetworkType } from './../../../database/models/Network';
import { queryNetworkById } from '../../../database/models/Network/query';
import {
  getAssetsAtomKey,
  getAssetsHash,
  getAssetsInFetch,
  getAssetsSortedKeys,
  setAssetsHash,
  setAssetsInFetch,
  setAssetsSortedKeys,
} from '../ReactInject/data/useAssets';
import trackAssets from './trackAssets';
import type { Fetcher } from './types';

export const getFetcherKey = ({ networkType, chainId }: { networkType: NetworkType; chainId?: string }) => {
  return typeof chainId === 'undefined' ? networkType : `${networkType}-${chainId}`;
};

export const updateCurrentTrackerSubject = new Subject<void>();

export interface IAssetsTrackerServerInterface {
  updateCurrentTracker: () => Promise<boolean | undefined>;
}

@injectable()
export class AssetsTrackerServer implements IAssetsTrackerServerInterface {
  public name = 'AssetsTracker';
  private fetcherMap = new Map<string, Fetcher>();
  private cancel$: Subject<void> | null = null;
  private currentSubscription?: Subscription;
  private currentNetwork: Network | undefined;
  private currentAddress: Address | undefined;

  @inject(SERVICE_IDENTIFIER.EVENT_BUS)
  private eventBus!: EventBus;

  register({ networkType, chainId, fetcher }: { networkType: NetworkType; chainId?: string; fetcher: Fetcher }) {
    if (!networkType && !chainId) {
      throw new Error('networkType or chainId is required');
    }
    const existFetcher = this.fetcherMap.get(getFetcherKey({ networkType, chainId })) ?? (Object.create(null) as Fetcher);
    Object.assign(existFetcher, fetcher);
    this.fetcherMap.set(getFetcherKey({ networkType, chainId }), existFetcher);
  }

  setup() {
    this.eventBus.on(CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT).subscribe(({ network, address }) => {
      this.currentNetwork = network;
      this.currentAddress = address;

      this.startPolling({ network, address });

      // TODO Update this!
      updateCurrentTrackerSubject.subscribe(() => {
        this.startPolling({ network: this.currentNetwork!, address: this.currentAddress! }, true);
      });
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

    const { resolve, reject, promise: firstFetchPromise } = Promise.withResolvers<boolean>();

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

      this.currentSubscription = interval(7777)
        .pipe(
          startWith(0),
          switchMap(() => {
            if (forceUpdate) {
              setAssetsInFetch(assetsAtomKey, true);
            }

            return from(trackAssets({ chainFetcher, networkFetcher, nativeAsset, network, address })).pipe(
              catchError((error) => {
                // console.log(error);
                reject(false);
                if (getAssetsInFetch(assetsAtomKey)) {
                  setAssetsInFetch(assetsAtomKey, false);
                }
                return of(null);
              }),
            );
          }),
          takeUntil(this.cancel$!),
        )
        .subscribe((trackRes) => {
          if (trackRes === null) return;
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
        });
    } catch (_) {
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
