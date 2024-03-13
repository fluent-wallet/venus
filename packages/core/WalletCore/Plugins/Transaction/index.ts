import { Transaction } from 'ethers';
import { NetworkType, Network } from '@core/database/models/Network';
import { type Plugin } from '../';
import EVMTranscation from './chains/evm';
import ConfluxTranscation from './chains/conflux';
import { type ITxEvm } from './types';

const getTranscationInstance = (network: Network) => (network.networkType === NetworkType.Conflux ? ConfluxTranscation : EVMTranscation);
declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    Transaction: TransactionPluginClass;
  }
}

class TransactionPluginClass implements Plugin {
  public name = 'Transaction';

  public getGasPrice = (network: Network) => {
    const transcationInstance = getTranscationInstance(network);
    return transcationInstance.getGasPrice(network.endpoint);
  };

  public estimateGas = ({ tx, network }: { network: Network; tx: ITxEvm }) => {
    const transcationInstance = getTranscationInstance(network);
    return transcationInstance.estimateGas({ tx, endpoint: network.endpoint, gasBuffer: network.gasBuffer });
  };

  public estimate = ({ tx, network }: { network: Network; tx: ITxEvm }) => {
    const transcationInstance = getTranscationInstance(network);
    return transcationInstance.estimate({ tx, endpoint: network.endpoint, gasBuffer: network.gasBuffer });
  };

  public getTransactionCount = ({ network, addressValue }: { network: Network; addressValue: string }) => {
    const transcationInstance = getTranscationInstance(network);
    return transcationInstance.getTransactionCount({ endpoint: network.endpoint, addressValue });
  };

  public sendRawTransaction = ({ network, txRaw }: { network: Network; txRaw: string }) => {
    const transcationInstance = getTranscationInstance(network);
    return transcationInstance.sendRawTransaction({ txRaw, endpoint: network.endpoint });
  };

  public signTransaction = ({ network, privateKey, transaction }: { network: Network; privateKey: string; transaction: Transaction }) => {
    const transcationInstance = getTranscationInstance(network);
    return transcationInstance.signTransaction({ transaction, privateKey });
  };
}

export default new TransactionPluginClass();
