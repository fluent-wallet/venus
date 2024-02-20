import { broadcastTransactionSubject } from '@core/WalletCore/Events/broadcastTransactionSubject';
import { type Plugin } from '../';
import Methods from '@core/WalletCore/Methods';
import { EthTxTrack } from './EthTxTrack';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    Transaction: TxTrackerPluginClass;
  }
}

class TxTrackerPluginClass implements Plugin {
  public name = 'TxTracker';
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

export default new TxTrackerPluginClass();
