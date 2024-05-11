import { Transaction as CoreTransaction } from 'js-conflux-sdk';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { addHexPrefix } from '@core/utils/base';
import methods from '@core/WalletCore/Methods';
import { NetworkType } from '@core/database/models/Network';
import { type ITxEvm } from '../types';
import { TypedDataDomain, TypedDataField, Wallet } from 'ethers';

class Transaction {
  public getGasPrice = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'cfx_gasPrice' });

  public estimateGas = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const isToAddressContract = await methods.checkIsContractAddress({ networkType: NetworkType.Conflux, endpoint: endpoint, addressValue: tx.to });
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

  public estimate = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const [gasPrice, { gasLimit, storageLimit }] = await Promise.all([this.getGasPrice(endpoint), this.estimateGas({ tx, endpoint, gasBuffer })]);
    return { gasPrice, gasLimit, storageLimit };
  };

  public getBlockNumber = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'cfx_epochNumber' });

  public getTransactionCount = ({ endpoint, addressValue }: { endpoint: string; addressValue: string }) =>
    fetchChain<string>({ url: endpoint, method: 'cfx_getNextNonce', params: [addressValue] });

  async signTransaction({ privateKey, tx, netId, blockNumber }: { privateKey: string; tx: ITxEvm; netId: number; blockNumber: string }) {
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
    _tx.epochHeight = blockNumber;
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
}

export default new Transaction();
