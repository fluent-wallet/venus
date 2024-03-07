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

  getTxProvider(network: Network | NetworkType) {
    const networkType = typeof network === 'string' ? network : network.networkType;
    if(networkType !== NetworkType.Ethereum) {
      throw new Error('get Transaction Provider error Unsupported network type')
    }
    
    if (this.providerCache[networkType]) {
      return this.providerCache[networkType];
    }
    // by now we only support EVM
    this.providerCache[networkType] = new EVMTransactionPlugin(network);
    return this.providerCache[networkType];
  }
}

export default new TransactionPluginClass();
