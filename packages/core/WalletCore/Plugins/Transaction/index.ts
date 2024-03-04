import { Network, NetworkType } from '@core/database/models/Network';
import { type Plugin } from '../';
import { EVMTransactionPlugin } from './evm';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    Transaction: TransactionPluginClass;
  }
}

class TransactionPluginClass implements Plugin {
  public name = 'Transaction';

  providerCache: { [k: string]: EVMTransactionPlugin } = {};

  getTxProvider(network: Network) {
    if(network.networkType !== NetworkType.Ethereum) {
      throw new Error('get Tx Provider error Unsupported network type')
    }
    
    if (this.providerCache[network.id]) {
      return this.providerCache[network.id];
    }
    // by now we only support EVM
    this.providerCache[network.id] = new EVMTransactionPlugin(network);
    return this.providerCache[network.id];
  }
}

export default new TransactionPluginClass();
