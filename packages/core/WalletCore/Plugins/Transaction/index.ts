import { broadcastTransactionSubject } from '@core/WalletCore/Events/broadcastTransactionSubject';
import { type Plugin } from '../';
import Methods from '@core/WalletCore/Methods';

class TransactionPluginClass implements Plugin {
  public name = 'Transaction';

  constructor() {
    broadcastTransactionSubject.subscribe(async (value) => {
      Methods.createTx(value);
    });
  }
}

export default new TransactionPluginClass();
