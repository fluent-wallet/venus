import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import methods from '@core/WalletCore/Methods';
import { NetworkType } from '@core/database/models/Network';
import { addHexPrefix } from '@core/utils/base';
import { type TypedDataDomain, type TypedDataField, Wallet } from 'ethers';
/* eslint-disable @typescript-eslint/ban-types */
import { Transaction as CoreTransaction } from 'js-conflux-sdk';
import {
  calcGasCostFromEstimate,
  calcGasCostFromEstimateOf1559,
  estimateFor1559FromGasPrice,
  estimateFromGasPrice,
  fetchGasEstimatesViaEthFeeHistory,
} from '../SuggestedGasEstimate';
import type { ITxEvm } from '../types';

class Transaction {
  public getGasPrice = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'cfx_gasPrice' });

  public estimateGas = async ({ tx, endpoint, gasBuffer = 1 }: { tx: Partial<ITxEvm>; endpoint: string; gasBuffer?: number }) => {
    const isToAddressContract = tx.to
      ? await methods.checkIsContractAddress({ networkType: NetworkType.Conflux, endpoint: endpoint, addressValue: tx.to })
      : true;
    const isSendNativeToken = (!!tx.to && !isToAddressContract) || !tx.data || tx.data === '0x';

    if (isSendNativeToken) return { gasLimit: addHexPrefix(BigInt(21000 * gasBuffer).toString(16)), storageLimit: '0x0' };

    const rst = await fetchChain<{ gasLimit: string; storageCollateralized: string }>({
      url: endpoint,
      method: 'cfx_estimateGasAndCollateral',
      params: [
        {
          from: tx.from,
          to: tx.to,
          value: tx.value,
          data: tx.data ? addHexPrefix(tx.data) : undefined,
        },
        'latest_state',
      ],
    });
    const { gasLimit, storageCollateralized } = rst;
    return { gasLimit: addHexPrefix((BigInt(gasLimit) * BigInt(gasBuffer)).toString(16)), storageLimit: storageCollateralized };
  };

  public checkPayContract = async ({ tx, endpoint }: { tx: ITxEvm; endpoint: string }) => {
    const isToAddressContract = await methods.checkIsContractAddress({ networkType: NetworkType.Conflux, endpoint: endpoint, addressValue: tx.to });
    const isSendNativeToken = (!!tx.to && !isToAddressContract) || !tx.data || tx.data === '0x';

    // TODO: check wether the balance is enough in sending native token
    const isBalanceEnough = true;

    // willPayCollateral = true means user needs to pay storage fee by himself
    // willPayTxFee = true means user needs to pay tx fee by himself
    if (isSendNativeToken) return { isBalanceEnough, willPayCollateral: true, willPayTxFee: true };

    const { from, to, gasLimit, gasPrice, storageLimit } = tx;

    const rst = await fetchChain<{ isBalanceEnough: boolean; willPayCollateral: boolean; willPayTxFee: boolean }>({
      url: endpoint,
      method: 'cfx_checkBalanceAgainstTransaction',
      params: [from, to, gasLimit, gasPrice, storageLimit, 'latest_state'],
    });

    return rst;
  };

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
    gasPrice: string;
    storageLimit?: string;
    estimate?: ReturnType<typeof calcGasCostFromEstimate>;
    estimateOf1559?: ReturnType<typeof calcGasCostFromEstimateOf1559>;
  }> => {
    const estimateGasLimitPromise = this.estimateGas({ tx, endpoint, gasBuffer });
    if (await this.isSupport1559(endpoint)) {
      // const [_estimateOf1559, { gasLimit, storageLimit }] = await Promise.all([
      //   fetchGasEstimatesViaEthFeeHistory(new QueryOf1559(endpoint)),
      //   estimateGasLimitPromise,
      // ]);
      // return { gasLimit, storageLimit, gasPrice, estimateOf1559: calcGasCostFromEstimateOf1559(_estimateOf1559, gasLimit) };
      const [gasPrice, { gasLimit, storageLimit }] = await Promise.all([this.getGasPrice(endpoint), estimateGasLimitPromise]);
      return { gasLimit, storageLimit, gasPrice, estimateOf1559: calcGasCostFromEstimateOf1559(estimateFor1559FromGasPrice(gasPrice), gasLimit) };
    }
    const [gasPrice, { gasLimit, storageLimit }] = await Promise.all([this.getGasPrice(endpoint), estimateGasLimitPromise]);
    return { gasLimit, storageLimit, gasPrice, estimate: calcGasCostFromEstimate(estimateFromGasPrice(gasPrice), gasLimit) };
  };

  public getBlockNumber = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'cfx_epochNumber' });

  public getTransactionCount = ({ endpoint, addressValue }: { endpoint: string; addressValue: string }) =>
    fetchChain<string>({ url: endpoint, method: 'cfx_getNextNonce', params: [addressValue] });

  async signTransaction({ privateKey, tx, netId, epochHeight }: { privateKey: string; tx: ITxEvm; netId: number; epochHeight: string }) {
    new CoreTransaction(tx);
    const _tx = Object.create(null);
    for (const key in tx) {
      if (key === 'gasLimit' || key === 'gasPrice' || key === 'storageLimit' || key === 'value') {
        if (tx[key as 'to']) {
          _tx[key === 'gasLimit' ? 'gas' : key] = BigInt(tx[key as 'to']).toString();
        }
      } else {
        _tx[key] = tx[key as 'to'];
      }
    }
    _tx.epochHeight = epochHeight;
    return new CoreTransaction(_tx).sign(addHexPrefix(privateKey), netId).serialize();
  }

  public sendRawTransaction = ({ txRaw, endpoint }: { txRaw: string; endpoint: string }) =>
    fetchChain<string>({ url: endpoint, method: 'cfx_sendRawTransaction', params: [txRaw] });

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
    const block = await fetchChain<{ baseFeePerGas: string }>({ url: endpoint, method: 'cfx_getBlockByEpochNumber', params: ['latest_state', false] });
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
      method: opts.method?.startsWith('eth_') ? `cfx_${opts.method.slice(4)}` : opts.method,
      params: opts.params,
    })
      .then((res) => callback(null, res))
      .catch((err) => callback(err));

  blockNumber = (callback: Function) => this.sendAsync({ method: 'cfx_epochNumber' }, callback);

  getBlockByNumber = (..._params: any) => {
    const params = _params;
    const callback = params.pop();
    return this.sendAsync({ method: 'cfx_getBlockByEpochNumber', params }, callback);
  };
}
