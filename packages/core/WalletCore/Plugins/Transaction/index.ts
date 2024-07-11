import { type Network, NetworkType } from '@core/database/models/Network';
import type { TypedDataDomain, TypedDataField } from 'ethers';
import type { Plugin } from '../';
import ConfluxTransaction from './chains/conflux';
import EVMTransaction from './chains/evm';
import type { ITxEvm } from './types';

const getTransactionInstance = (network: Pick<Network, 'networkType'>) => (network.networkType === NetworkType.Conflux ? ConfluxTransaction : EVMTransaction);
declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    Transaction: TransactionPluginClass;
  }
}

class TransactionPluginClass implements Plugin {
  public name = 'Transaction';

  public getGasPrice = (network: Pick<Network, 'networkType' | 'endpoint'>) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.getGasPrice(network.endpoint);
  };

  public estimateGas = ({ tx, network }: { network: Pick<Network, 'networkType' | 'endpoint' | 'gasBuffer'>; tx: ITxEvm }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.estimateGas({ tx, endpoint: network.endpoint, gasBuffer: network.gasBuffer });
  };

  public estimate = ({ tx, network }: { network: Pick<Network, 'networkType' | 'endpoint' | 'gasBuffer'>; tx: Partial<ITxEvm> }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.estimate({ tx, endpoint: network.endpoint, gasBuffer: network.gasBuffer }) as ReturnType<
      (typeof ConfluxTransaction)['estimate']
    >;
  };

  public getBlockNumber = (network: Pick<Network, 'networkType' | 'endpoint'>) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.getBlockNumber(network.endpoint);
  };

  public getTransactionCount = ({ network, addressValue }: { network: Pick<Network, 'networkType' | 'endpoint'>; addressValue: string }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.getTransactionCount({ endpoint: network.endpoint, addressValue });
  };

  public signTransaction = ({
    network,
    privateKey,
    tx,
    epochHeight,
  }: { network: Pick<Network, 'networkType' | 'endpoint' | 'netId'>; privateKey: string; tx: ITxEvm; epochHeight: string }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.signTransaction({ tx, privateKey, netId: network.netId, epochHeight });
  };

  public sendRawTransaction = ({ network, txRaw }: { network: Pick<Network, 'networkType' | 'endpoint'>; txRaw: string }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.sendRawTransaction({ txRaw, endpoint: network.endpoint });
  };
  public signMessage = ({ message, privateKey, network }: { message: string; privateKey: string; network: Pick<Network, 'networkType' | 'endpoint'> }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.signMessage({ message, privateKey });
  };
  public signTypedData = ({
    domain,
    types,
    value,
    privateKey,
    network,
  }: {
    domain: TypedDataDomain;
    types: Record<string, TypedDataField[]>;
    value: Record<string, any>;
    privateKey: string;
    network: Network;
  }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.signTypedData({ domain, types, value, privateKey });
  };
}

export default new TransactionPluginClass();
