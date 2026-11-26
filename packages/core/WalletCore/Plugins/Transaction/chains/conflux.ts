import { NetworkType } from '@core/database/models/Network';
import { HttpJsonRpcClient } from '@core/rpc';
import { addHexPrefix } from '@core/utils/base';
import methods from '@core/WalletCore/Methods';
import { type TypedDataDomain, type TypedDataField, Wallet } from 'ethers';
import { calcGasCostFromEstimate, calcGasCostFromEstimateOf1559, estimateFor1559FromGasPrice, estimateFromGasPrice } from '../SuggestedGasEstimate';
import type { ITxEvm } from '../types';

class Transaction {
  public getGasPrice = (endpoint: string) => new HttpJsonRpcClient(endpoint).request<string>('cfx_gasPrice');

  public estimateGas = async ({ tx, endpoint, gasBuffer = 1 }: { tx: Partial<ITxEvm>; endpoint: string; gasBuffer?: number }) => {
    const isToAddressContract = tx.to
      ? await methods.checkIsContractAddress({ networkType: NetworkType.Conflux, endpoint: endpoint, addressValue: tx.to })
      : true;
    const isSendNativeToken = (!!tx.to && !isToAddressContract) || !tx.data || tx.data === '0x';

    if (isSendNativeToken) return { gasLimit: addHexPrefix(BigInt(21000 * gasBuffer).toString(16)), storageLimit: '0x0' };

    const rst = await new HttpJsonRpcClient(endpoint).request<{ gasLimit: string; storageCollateralized: string }>('cfx_estimateGasAndCollateral', [
      {
        from: tx.from,
        to: tx.to,
        value: tx.value,
        data: tx.data ? addHexPrefix(tx.data) : undefined,
      },
      'latest_state',
    ]);
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

    const rst = await new HttpJsonRpcClient(endpoint).request<{ isBalanceEnough: boolean; willPayCollateral: boolean; willPayTxFee: boolean }>(
      'cfx_checkBalanceAgainstTransaction',
      [from, to, gasLimit, gasPrice, storageLimit, 'latest_state'],
    );

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
      const [gasPrice, { gasLimit, storageLimit }] = await Promise.all([this.getGasPrice(endpoint), estimateGasLimitPromise]);
      return { gasLimit, storageLimit, gasPrice, estimateOf1559: calcGasCostFromEstimateOf1559(estimateFor1559FromGasPrice(gasPrice), gasLimit) };
    }
    const [gasPrice, { gasLimit, storageLimit }] = await Promise.all([this.getGasPrice(endpoint), estimateGasLimitPromise]);
    return { gasLimit, storageLimit, gasPrice, estimate: calcGasCostFromEstimate(estimateFromGasPrice(gasPrice), gasLimit) };
  };

  public getBlockNumber = (endpoint: string) => new HttpJsonRpcClient(endpoint).request<string>('cfx_epochNumber');

  public getTransactionCount = ({ endpoint, addressValue }: { endpoint: string; addressValue: string }) =>
    new HttpJsonRpcClient(endpoint).request<string>('cfx_getNextNonce', [addressValue]);

  public sendRawTransaction = ({ txRaw, endpoint }: { txRaw: string; endpoint: string }) =>
    new HttpJsonRpcClient(endpoint).request<string>('cfx_sendRawTransaction', [txRaw]);

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
    const block = await new HttpJsonRpcClient(endpoint).request<{ baseFeePerGas: string }>('cfx_getBlockByEpochNumber', ['latest_state', false]);
    return block.baseFeePerGas !== undefined;
  };
}

export default new Transaction();
