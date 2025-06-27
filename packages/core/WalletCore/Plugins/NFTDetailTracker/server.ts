import { isEqual } from 'lodash-es';
import { BehaviorSubject } from 'rxjs';
import { Subject, type Subscription, interval, startWith, switchMap, takeUntil } from 'rxjs';
import type { AssetInfo } from '../../Plugins/AssetsTracker/types';
import { getCurrentOpenNFTDetail, setCurrentOpenNFTDetail } from '../ReactInject/data/useAssets';
import type { NetworkType } from './../../../database/models/Network';
import { inject, injectable } from 'inversify';
import { CURRENT_ACCOUNT_CHANGED_EVENT, CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT, type EventBus } from '@core/WalletCore/Events/eventTypes';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';

export interface NFTItemDetail {
  name: string;
  description?: string | null;
  icon?: string | null;
  amount: string;
  tokenId: string;
}

export type NFTWithDetail = AssetInfo & { detail: NFTItemDetail };

export type FetcherParams = { accountAddress: string; nftAddress: string };
export type Fetcher = (params: FetcherParams) => Promise<NFTItemDetail[]>;
export const currentOpenNFTSubject = new BehaviorSubject<{ nft: AssetInfo; index?: number } | undefined>(undefined);

const getFetcherKey = ({ networkType, chainId }: { networkType: NetworkType; chainId: string }) => `${networkType}-${chainId}`;

export interface INFTDetailTrackerServerInterface {
  setCurrentOpenNFT: (params?: {
    nft: AssetInfo;
    index?: number;
  }) => void;

  updateCurrentOpenNFT: (targetNftAddress?: string | null) => void;
}

@injectable()
export class NFTDetailTrackerServer implements INFTDetailTrackerServerInterface {
  private fetcherMap = new Map<string, Fetcher>();
  private cancel$: Subject<void> | null = null;
  private currentNFTSubscription?: Subscription;
  private currentPollingSubscription?: Subscription;

  @inject(SERVICE_IDENTIFIER.EVENT_BUS)
  private eventBus!: EventBus;

  register({ networkType, chainId, fetcher }: { networkType: NetworkType; chainId: string; fetcher: Fetcher }) {
    if (!networkType || !chainId) {
      throw new Error('networkType and chainId is required');
    }
    this.fetcherMap.set(getFetcherKey({ networkType, chainId }), fetcher);
  }

  setup() {
    this.eventBus.on(CURRENT_ACCOUNT_CHANGED_EVENT).subscribe(() => {
      setCurrentOpenNFTDetail(undefined);
    });

    this.eventBus.on(CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT).subscribe((payload) => {
      const { network, address } = payload;
      if (this.currentNFTSubscription) {
        this.currentNFTSubscription?.unsubscribe();
        this.currentNFTSubscription = undefined;
      }
      if (this.currentPollingSubscription) {
        this.currentPollingSubscription?.unsubscribe();
        this.currentPollingSubscription = undefined;
      }

      this.setCurrentOpenNFT(undefined);
      setCurrentOpenNFTDetail(undefined);
      const fetcher = this.fetcherMap.get(getFetcherKey({ networkType: network.networkType, chainId: network.chainId }));
      if (!fetcher) return;

      this.currentNFTSubscription = currentOpenNFTSubject.subscribe((params) => {
        if (!params) {
          this.cancelCurrentPollingTracker();
          setCurrentOpenNFTDetail(undefined);
          return;
        }
        setCurrentOpenNFTDetail(params);
        this.startPolling({ params, accountAddress: address.hex, fetcher });
      });
    });
  }

  /** This function immediately start a tracker for the current nft and returns a Promise that resolves when first fetchDetail success. */
  private startPolling = async (
    { params: { nft, index }, accountAddress, fetcher }: { params: { nft: AssetInfo; index?: number }; accountAddress: string; fetcher: Fetcher },
    forceUpdate = false,
  ) => {
    if (!forceUpdate) {
      this.disposeCurrentPollingSubscription();
    } else {
      this.cancelCurrentPollingTracker;
    }

    this.cancel$ = new Subject<void>();

    const { resolve, reject, promise: firstFetchPromise } = Promise.withResolvers<boolean>();

    try {
      this.currentPollingSubscription = interval(7777)
        .pipe(
          startWith(0),
          switchMap(() => fetcher({ nftAddress: nft.contractAddress!, accountAddress })),
          takeUntil(this.cancel$!),
        )
        .subscribe({
          next: (items) => {
            const res = { nft, index, items };
            if (!isEqual(getCurrentOpenNFTDetail(), res)) {
              setCurrentOpenNFTDetail(res);
            }
            resolve(true);
          },
          error: (error) => {
            // console.log(`Error in trackAssets(network-${network.name} address-${address.hex}):`, error);
            reject(false);
          },
          complete: () => {
            // console.log(`trackAssets(network-${network.name} address-${address.hex}) completed or canceled`);
            reject(false);
          },
        });
    } catch (_) {
      // console.log()
      reject(false);
    }

    return firstFetchPromise;
  };

  private disposeCurrentPollingSubscription = () => {
    this.currentPollingSubscription?.unsubscribe();
    this.currentPollingSubscription = undefined;
  };

  public cancelCurrentPollingTracker = () => {
    this.cancel$?.next();
    this.disposeCurrentPollingSubscription();
    this.cancel$ = null;
  };

  public setCurrentOpenNFT = (params?: { nft: AssetInfo; index?: number }) => currentOpenNFTSubject.next(params);

  public updateCurrentOpenNFT = (targetNftAddress?: string | null) => {
    const current = currentOpenNFTSubject.getValue();
    if ((current && !targetNftAddress) || (current && targetNftAddress && current.nft.contractAddress === targetNftAddress)) {
      this.setCurrentOpenNFT(current);
    }
  };
}
