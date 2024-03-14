import { Transaction } from 'ethers';
import { NetworkType, Network } from '@core/database/models/Network';
import { type Plugin } from '../';
import EVMTransaction from './chains/evm';
import ConfluxTransaction from './chains/conflux';
import { type ITxEvm } from './types';

const getTransactionInstance = (network: Network) => (network.networkType === NetworkType.Conflux ? ConfluxTransaction : EVMTransaction);
declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    Transaction: TransactionPluginClass;
  }
}

class TransactionPluginClass implements Plugin {
  public name = 'Transaction';

  public getGasPrice = (network: Network) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.getGasPrice(network.endpoint);
  };

  public estimateGas = ({ tx, network }: { network: Network; tx: ITxEvm }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.estimateGas({ tx, endpoint: network.endpoint, gasBuffer: network.gasBuffer });
  };

  public estimate = ({ tx, network }: { network: Network; tx: ITxEvm }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.estimate({ tx, endpoint: network.endpoint, gasBuffer: network.gasBuffer }) as ReturnType<
      (typeof ConfluxTransaction)['estimate']
    >;
  };
  
  public getBlockNumber = (network: Network) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.getBlockNumber(network.endpoint);
  };

  public getTransactionCount = ({ network, addressValue }: { network: Network; addressValue: string }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.getTransactionCount({ endpoint: network.endpoint, addressValue });
  };

  public signTransaction = ({ network, privateKey, tx, blockNumber }: { network: Network; privateKey: string; tx: ITxEvm; blockNumber: string }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.signTransaction({ tx, privateKey, netId: network.netId, blockNumber });
  };

  public sendRawTransaction = ({ network, txRaw }: { network: Network; txRaw: string }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.sendRawTransaction({ txRaw, endpoint: network.endpoint });
  };
}

export default new TransactionPluginClass();
