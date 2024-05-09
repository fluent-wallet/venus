import { Transaction as EVMTransaction, TypedDataDomain, TypedDataField, Wallet } from 'ethers';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { addHexPrefix } from '@core/utils/base';
import { NetworkType } from '@core/database/models/Network';
import methods from '@core/WalletCore/Methods';
import { type ITxEvm } from '../types';

class Transaction {
  public getGasPrice = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'eth_gasPrice' });

  public estimateGas = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const isToAddressContract = methods.checkIsContractAddress({ networkType: NetworkType.Ethereum, endpoint: endpoint, addressValue: tx.to });
    const isSendNativeToken = (!!tx.to && !isToAddressContract) || !tx.data || tx.data === '0x';
    if (isSendNativeToken) return addHexPrefix(BigInt(21000 * gasBuffer).toString(16));

    const gas = await fetchChain<string>({
      url: endpoint,
      method: 'eth_estimateGas',
      params: [
        {
          from: addHexPrefix(tx.from),
          to: addHexPrefix(tx.to),
          value: tx.value,
          data: tx.data ? addHexPrefix(tx.data) : undefined,
        },
        'latest',
      ],
    });
    return addHexPrefix((BigInt(gas) * BigInt(gasBuffer)).toString(16));
  };

  public getBlockNumber = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'eth_blockNumber' });

  public estimate = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const [gasPrice, gasLimit] = await Promise.all([this.getGasPrice(endpoint), this.estimateGas({ tx, endpoint, gasBuffer })]);
    return { gasPrice, gasLimit };
  };

  public getTransactionCount = ({ endpoint, addressValue }: { endpoint: string; addressValue: string }) =>
    fetchChain<string>({ url: endpoint, method: 'eth_getTransactionCount', params: [addressValue, 'pending'] });

  async signTransaction({ privateKey, tx }: { privateKey: string; tx: ITxEvm }) {
    const transaction = new EVMTransaction();
    for (const key in tx) {
      transaction[key as 'to'] = tx[key as 'to'];
    }
    const wallet = new Wallet(privateKey);
    return wallet.signTransaction(transaction);
  }

  public sendRawTransaction = ({ txRaw, endpoint }: { txRaw: string; endpoint: string }) =>
    fetchChain<string>({
      url: endpoint,
      method: 'eth_sendRawTransaction',
      params: [txRaw],
    });

  public signMessage = ({ message, privateKey }: { message: string; privateKey: string }) => {
    const wallet = new Wallet(privateKey);
    return wallet.signMessage(message);
  };
  public signTypedData = ({
    domain,
    types: _types,
    value,
    privateKey,
  }: {
    domain: TypedDataDomain;
    types: Record<string, TypedDataField[]>;
    value: Record<string, any>;
    privateKey: string;
  }) => {
    const wallet = new Wallet(privateKey);
    // https://github.com/ethers-io/ethers.js/discussions/3163
    const { EIP712Domain, ...types } = _types;
    return wallet.signTypedData(domain, types, value);
  };
}

export default new Transaction();
