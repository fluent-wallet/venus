import type { Network } from '@core/database/models/Network';
import { SUGGESTED_EPOCH_NUMBER_OFFSET_IN_CORE } from '@core/utils/consts';
import { catchError, debounceTime, interval, retry, type Subscription, startWith, switchMap, throwError } from 'rxjs';
import type { Plugin } from '../';
import { currentNetworkObservable } from '../ReactInject/data/useCurrentNetwork';
import Transaction from '../Transaction';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    BlockNumberTracker: BlockNumberTracker;
  }
}

export const checkDiffInRange = (diff: bigint, range: [bigint, bigint] = [-SUGGESTED_EPOCH_NUMBER_OFFSET_IN_CORE, SUGGESTED_EPOCH_NUMBER_OFFSET_IN_CORE]) =>
  diff >= BigInt(range[0]) && diff <= BigInt(range[1]);

class BlockNumberTracker implements Plugin {
  public name = 'BlockNumberTracker';
  private _network: Network | null = null;
  private _blockNumber: string | null = null;
  private _pollingSub: Subscription | null = null;

  constructor() {
    this._setup();
  }

  private _setup() {
    currentNetworkObservable.pipe(debounceTime(40)).subscribe((currentNetwork) => {
      this._network = currentNetwork;
      this._blockNumber = null;
      this._startup(currentNetwork);
    });
  }

  private _startup(network: Pick<Network, 'id' | 'endpoint' | 'networkType'> | null) {
    this._pollingSub?.unsubscribe();
    if (network) {
      this._pollingSub = interval(15000)
        .pipe(
          startWith(0),
          switchMap(() => Transaction.getBlockNumber(network)),
          catchError((err: { code: string; message: string }) => {
            console.error('get block number error: ', err);
            return throwError(() => err);
          }),
          retry({ delay: 1000 }),
        )
        .subscribe((res) => {
          this._blockNumber = res;
        });
    }
  }

  public async getNetworkBlockNumber(network: Pick<Network, 'id' | 'endpoint' | 'networkType'>): Promise<string> {
    if (this._network?.id === network.id && this._blockNumber) {
      return this._blockNumber;
    }
    return Transaction.getBlockNumber(network);
  }

  public async checkBlockNumberInRange(
    network: Pick<Network, 'id' | 'endpoint' | 'networkType'>,
    blockNumber: string | number | bigint,
    range?: [bigint, bigint],
  ): Promise<boolean> {
    const networkBlockNumber = await this.getNetworkBlockNumber(network);
    const diff = BigInt(networkBlockNumber) - BigInt(blockNumber);
    return checkDiffInRange(diff, range);
  }
}

export default new BlockNumberTracker();
