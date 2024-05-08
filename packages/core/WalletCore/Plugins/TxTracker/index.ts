import { broadcastTransactionSubject } from '@core/WalletCore/Events/broadcastTransactionSubject';
import { type Plugin } from '../';
import Methods from '@core/WalletCore/Methods';
import { EthTxTrack } from './EthTxTrack';
import { CFXTxTrack } from './CFXTxTrack';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    TxTracker: TxTrackerPluginClass;
  }
}

class TxTrackerPluginClass implements Plugin {
  public name = 'TxTracker';
  private _ethTracker = new EthTxTrack();
  private _cfxTracker = new CFXTxTrack();

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
