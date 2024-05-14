import { debounceTime, interval, startWith, switchMap, Subscription } from 'rxjs';
import { type Plugin } from '../';
import events from '@core/WalletCore/Events';
import { Network } from '@core/database/models/Network';
import Transaction from '../Transaction';
import { MAX_EPOCH_NUMBER_OFFSET } from '@core/consts/network';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    BlockNumberTracker: BlockNumberTracker;
  }
}

export const checkDiffInRange = (diff: bigint, range: [bigint, bigint] = [-MAX_EPOCH_NUMBER_OFFSET, MAX_EPOCH_NUMBER_OFFSET]) =>
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
    events.currentNetworkObservable.pipe(debounceTime(40)).subscribe((currentNetwork) => {
      this._network = currentNetwork;
      this._startup(currentNetwork);
    });
  }

  private _startup(network: Network | null) {
    this._pollingSub?.unsubscribe();
    if (network) {
      this._pollingSub = interval(15000)
        .pipe(
          startWith(0),
          switchMap(() => Transaction.getBlockNumber(network)),
        )
        .subscribe({
          next: (res) => {
            this._blockNumber = res;
          },
          error: (err) => {
            console.error('get block number error: ', err);
          },
        });
    }
  }

  public async getNetworkBlockNumber(network: Network): Promise<string> {
    if (this._network?.id === network.id && this._blockNumber) {
      return this._blockNumber;
    }
    return Transaction.getBlockNumber(network);
  }

  public async checkBlockNumberInRange(network: Network, blockNumber: string | number | bigint, range?: [bigint, bigint]): Promise<boolean> {
    const networkBlockNumber = await this.getNetworkBlockNumber(network);
    const diff = BigInt(networkBlockNumber) - BigInt(blockNumber);
    return checkDiffInRange(diff, range);
  }
}

export default new BlockNumberTracker();
