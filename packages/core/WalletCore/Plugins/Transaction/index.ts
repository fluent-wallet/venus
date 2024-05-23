import { Transaction, TypedDataDomain, TypedDataField } from 'ethers';
import { NetworkType, Network } from '@core/database/models/Network';
import { type Plugin } from '../';
import EVMTransaction from './chains/evm';
import ConfluxTransaction from './chains/conflux';
import { type ITxEvm } from './types';
import { CFX_ESPACE_TESTNET_CHAINID, CFX_ESPACE_MAINNET_CHAINID, CFX_MAINNET_CHAINID, CFX_TESTNET_CHAINID } from '@core/consts/network';

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

  public estimate = ({ tx, network }: { network: Network; tx: Partial<ITxEvm> }) => {
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

  public signTransaction = ({ network, privateKey, tx, epochHeight }: { network: Network; privateKey: string; tx: ITxEvm; epochHeight: string }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.signTransaction({ tx, privateKey, netId: network.netId, epochHeight });
  };

  public sendRawTransaction = ({ network, txRaw }: { network: Network; txRaw: string }) => {
    const transactionInstance = getTransactionInstance(network);
    return transactionInstance.sendRawTransaction({ txRaw, endpoint: network.endpoint });
  };
  public signMessage = ({ message, privateKey, network }: { message: string; privateKey: string; network: Network }) => {
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
  public isOnlyLegacyTxSupport = (chainId: string) => {

    //  for now conflux network only support 155
    const eSpaceLegacyChainIds = [CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID];
    const coreSpaceLegacyChainIds = [CFX_MAINNET_CHAINID, CFX_TESTNET_CHAINID];

    const legacyChainIds = [...eSpaceLegacyChainIds, ...coreSpaceLegacyChainIds];
    return legacyChainIds.includes(chainId);
  };
}

export default new TransactionPluginClass();
