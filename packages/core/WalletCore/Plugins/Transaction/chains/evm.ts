/* eslint-disable @typescript-eslint/ban-types */
import { Transaction as EVMTransaction, TypedDataDomain, TypedDataField, Wallet } from 'ethers';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { addHexPrefix } from '@core/utils/base';
import { NetworkType } from '@core/database/models/Network';
import methods from '@core/WalletCore/Methods';
import { type ITxEvm } from '../types';
import fetchGasEstimatesViaEthFeeHistory from '../fetchGasEstimatesViaEthFeeHistory';

class Transaction {
  public getGasPrice = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'eth_gasPrice' });

  public estimateGas = async ({ tx, endpoint, gasBuffer = 1 }: { tx: Partial<ITxEvm>; endpoint: string; gasBuffer?: number }) => {
    const isToAddressContract = tx.to
      ? await methods.checkIsContractAddress({ networkType: NetworkType.Ethereum, endpoint: endpoint, addressValue: tx.to })
      : true;
    const isSendNativeToken = (!!tx.to && !isToAddressContract) || !tx.data || tx.data === '0x';
    if (isSendNativeToken) return addHexPrefix(BigInt(21000 * gasBuffer).toString(16));

    const gas = await fetchChain<string>({
      url: endpoint,
      method: 'eth_estimateGas',
      params: [
        {
          from: tx.from ? addHexPrefix(tx.from) : undefined,
          to: tx.to ? addHexPrefix(tx.to) : undefined,
          value: tx.value ? tx.value : undefined,
          data: tx.data ? addHexPrefix(tx.data) : undefined,
        },
        'latest',
      ],
    });
    return addHexPrefix((BigInt(gas) * BigInt(gasBuffer)).toString(16));
  };

  public getBlockNumber = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'eth_blockNumber' });

  public estimate = async ({
    tx,
    endpoint,
    gasBuffer = 1,
  }: {
    tx: Partial<ITxEvm>;
    endpoint: string;
    gasBuffer?: number;
  }): Promise<{
    gasLimit: string;
    gasPrice?: string;
    estimateOf1559?: Awaited<ReturnType<typeof fetchGasEstimatesViaEthFeeHistory>>;
  }> => {
    const estimateGasLimitPromise = this.estimateGas({ tx, endpoint, gasBuffer });
    if (await this.isSupport1559(endpoint)) {
      const [estimateOf1559, gasLimit] = await Promise.all([fetchGasEstimatesViaEthFeeHistory(new QueryOf1559(endpoint)), estimateGasLimitPromise]);
      return { estimateOf1559, gasLimit };
    } else {
      const [gasPrice, gasLimit] = await Promise.all([this.getGasPrice(endpoint), estimateGasLimitPromise]);
      return { gasPrice, gasLimit };
    }
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

  public isSupport1559 = async (endpoint: string) => {
    const block = await fetchChain<{ baseFeePerGas: string }>({ url: endpoint, method: 'eth_getBlockByNumber', params: ['latest', false] });
    return block.baseFeePerGas !== undefined;
  };
}

export default new Transaction();

class QueryOf1559 {
  endpoint: string;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  public sendAsync = (opts: any, callback: Function) =>
    fetchChain({
      url: this.endpoint,
      method: opts.method,
      params: opts.params,
    })
      .then((res) => callback(null, res))
      .catch((err) => callback(err));

  blockNumber = (callback: Function) => this.sendAsync({ method: 'eth_blockNumber' }, callback);

  getBlockByNumber = (..._params: any) => {
    const params = _params;
    const callback = params.pop();
    return this.sendAsync({ method: 'eth_getBlockByNumber', params }, callback);
  };
}
