import { Transaction as EVMTransaction, Wallet } from 'ethers';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { addHexPrefix } from '@core/utils/base';
import methods from '@core/WalletCore/Methods';
import { NetworkType } from '@core/database/models/Network';
import { type ITxEvm } from '../types';

class Transaction {
  public getGasPrice = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'cfx_gasPrice' });

  public estimateGas = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const isToAddressContract = methods.checkIsContractAddress({ networkType: NetworkType.Conflux, endpoint: endpoint, addressValue: tx.to });
    const isSendNativeToken = (!!tx.to && !isToAddressContract) || !tx.data || tx.data === '0x';

    if (isSendNativeToken) return {gasLimit: addHexPrefix(BigInt(21000 * gasBuffer).toString(16)), storageCollateralized: '0x0'};

    const rst = await fetchChain<{gasLimit: string, storageCollateralized: string}>({
      url: endpoint,
      method: 'cfx_estimateGasAndCollateral',
      params: [
        {
          from: addHexPrefix(tx.from),
          to: addHexPrefix(tx.to),
          value: tx.value,
          data: tx.data ? addHexPrefix(tx.data) : undefined,
        },
        'latest_state',
      ],
    });
    const {gasLimit, storageCollateralized} = rst
    return {gasLimit: addHexPrefix((BigInt(gasLimit) * BigInt(gasBuffer)).toString(16)), storageLimit: storageCollateralized};
  };

  public checkPayContract = async({tx, endpoint}: { tx: ITxEvm; endpoint: string; }) => {
    const isToAddressContract = methods.checkIsContractAddress({ networkType: NetworkType.Conflux, endpoint: endpoint, addressValue: tx.to });
    const isSendNativeToken = (!!tx.to && !isToAddressContract) || !tx.data || tx.data === '0x';

    // TODO: check wether the balance is enough in sending native token
    const isBalanceEnough = true

    // willPayCollateral = true means user needs to pay storage fee by himself
    // willPayTxFee = true means user needs to pay tx fee by himself
    if (isSendNativeToken) return {isBalanceEnough, willPayCollateral: true, willPayTxFee : true};

    const {from, to, gasLimit, gasPrice, storageLimit} = tx

    const rst = await fetchChain<{isBalanceEnough: boolean, willPayCollateral: boolean, willPayTxFee: boolean}>({
      url: endpoint,
      method: 'cfx_checkBalanceAgainstTransaction',
      params: [
        from,
        to,
        gasLimit,
        gasPrice,
        storageLimit,
        'latest_state',
      ],
    });

    return rst;
  }

  public estimate = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const [gasPrice, {gasLimit, storageLimit}, {isBalanceEnough, willPayCollateral, willPayTxFee}] = await Promise.all([this.getGasPrice(endpoint), this.estimateGas({ tx, endpoint, gasBuffer }), this.checkPayContract({ tx, endpoint })]);
    return { gasPrice, gasLimit, storageLimit, isBalanceEnough, willPayCollateral, willPayTxFee};
  };

  public getTransactionCount = ({ endpoint, addressValue }: { endpoint: string; addressValue: string }) =>
    fetchChain<string>({ url: endpoint, method: 'cfx_getNextUsableNonce', params: [addressValue] });

  public sendRawTransaction = ({ txRaw, endpoint }: { txRaw: string; endpoint: string }) =>
    fetchChain<string>({ url: endpoint, method: 'cfx_sendRawTransaction', params: [txRaw] });

  async signTransaction({ privateKey, transaction }: { privateKey: string; transaction: EVMTransaction }) {
    const wallet = new Wallet(privateKey);
    return wallet.signTransaction(transaction);
  }
}

export default new Transaction();
