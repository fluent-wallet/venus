import { BehaviorSubject } from 'rxjs';
import { interval, switchMap, takeUntil, Subject, startWith, type Subscription } from 'rxjs';
import { isEqual } from 'lodash-es';
import { NetworkType } from './../../../database/models/Network';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '../../../consts/network';
import events from '../../Events';
import { type AssetInfo } from '../../Plugins/AssetsTracker/types';
import { type Plugin } from '../../Plugins';
import { fetchNFTDetail as fetchESpaceNFTDetail } from './fetchers/eSpace';
import { setCurrentOpenNFTDetail, getCurrentOpenNFTDetail } from '../ReactInject/data/useAssets';

export interface NFTItemDetail {
  name: string;
  description?: string | null;
  icon?: string | null;
  amount: string;
  tokenId: string;
}

export type NFTWithDetail = AssetInfo & { detail: NFTItemDetail };

type FetcherParams = { accountAddress: string; nftAddress: string };
type Fetcher = (params: FetcherParams) => Promise<NFTItemDetail[]>;

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    NFTDetailTracker: NFTDetailTrackerPluginClass;
  }
}

const getFetcherKey = ({ networkType, chainId }: { networkType: NetworkType; chainId: string }) => `${networkType}-${chainId}`;

class NFTDetailTrackerPluginClass implements Plugin {
  public name = 'NFTDetailTracker';
  private fetcherMap = new Map<string, Fetcher>();
  private cancel$: Subject<void> | null = null;
  private currentNFTSubscription?: Subscription;
  private currentPollingSubscription?: Subscription;
  private currentOpenNFTSubject = new BehaviorSubject<{ nft: AssetInfo; index?: number } | undefined>(undefined);

  constructor() {
    this.register({
      networkType: NetworkType.Ethereum,
      chainId: CFX_ESPACE_TESTNET_CHAINID,
      fetcher: (params: FetcherParams) => fetchESpaceNFTDetail({ ...params, isTestnet: true }),
    });
    this.register({
      networkType: NetworkType.Ethereum,
      chainId: CFX_ESPACE_MAINNET_CHAINID,
      fetcher: (params: FetcherParams) => fetchESpaceNFTDetail({ ...params, isTestnet: false }),
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
    events.currentAccountChangedSubject.subscribe(() => {
      setCurrentOpenNFTDetail(undefined);
    });

    events.combineNetworkAndAddressChangedSubject.subscribe(([network, address]) => {
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

      this.currentNFTSubscription = this.currentOpenNFTSubject.subscribe((params) => {
        if (!params) {
          this.cancelCurrentPollingTracker();
          setCurrentOpenNFTDetail(undefined);
          return;
        } else {
          setCurrentOpenNFTDetail(params);
          this.startPolling({ params, accountAddress: address.hex, fetcher });
        }
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

    let resolve!: (value: boolean | PromiseLike<boolean>) => void, reject!: (reason?: any) => void;
    const firstFetchPromise = new Promise<boolean>((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

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

  public setCurrentOpenNFT = (params?: { nft: AssetInfo; index?: number }) => this.currentOpenNFTSubject.next(params);

  public updateCurrentOpenNFT = (targetNftAddress?: string | null) => {
    const current = this.currentOpenNFTSubject.getValue();
    if ((current && !targetNftAddress) || (current && targetNftAddress && current.nft.contractAddress === targetNftAddress)) {
      this.setCurrentOpenNFT(current);
    }
  };
}

export default new NFTDetailTrackerPluginClass();
