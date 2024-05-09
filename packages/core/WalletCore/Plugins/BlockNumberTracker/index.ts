import { debounceTime, interval, startWith, switchMap, Subscription } from 'rxjs';
import { type Plugin } from '../';
import events from '@core/WalletCore/Events';
import { Network } from '@core/database/models/Network';
import Transaction from '../Transaction';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    BlockNumberTracker: BlockNumberTracker;
  }
}

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
}

export default new BlockNumberTracker();
