import { broadcastTransactionSubject } from '@core/WalletCore/Events/broadcastTransactionSubject';
import { type Plugin } from '../';
import Methods from '@core/WalletCore/Methods';
import { EthTxTrack } from './EthTxTrack';

class TransactionPluginClass implements Plugin {
  public name = 'Transaction';
  private _ethTracker = new EthTxTrack();

  constructor() {
    this._setup();
  }

  private _setup() {
    broadcastTransactionSubject.subscribe(async (value) => {
      Methods.createTx(value);
    });
  }
}

export default new TransactionPluginClass();
