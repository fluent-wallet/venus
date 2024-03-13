import { Transaction, Wallet } from 'ethers';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { addHexPrefix } from '@core/utils/base';
import methods from '@core/WalletCore/Methods';
import { NetworkType } from '@core/database/models/Network';
import { type ITxEvm } from '../types';

class Transcation {
  public getGasPrice = (endpoint: string) => fetchChain<string>({ url: endpoint, method: 'cfx_gasPrice' });

  public estimateGas = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const isToAddressContract = methods.checkIsContractAddress({ networkType: NetworkType.Conflux, endpoint: endpoint, addressValue: tx.to });
    const isSendNativeToken = (!!tx.to && !isToAddressContract) || !tx.data || tx.data === '0x';

    if (isSendNativeToken) return addHexPrefix(BigInt(21000 * gasBuffer).toString(16));

    const gas = await fetchChain<string>({
      url: endpoint,
      method: 'cfx_estimateGas',
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
    return addHexPrefix((BigInt(gas) * BigInt(gasBuffer)).toString(16));
  };

  public estimate = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const [gasPrice, gasLimit] = await Promise.all([this.getGasPrice(endpoint), this.estimateGas({ tx, endpoint, gasBuffer })]);
    return { gasPrice, gasLimit };
  };

  public getTransactionCount = ({ endpoint, addressValue }: { endpoint: string; addressValue: string }) =>
    fetchChain<string>({ url: endpoint, method: 'cfx_getNextNonce', params: [addressValue, 'latest_state'] });

  public sendRawTransaction = ({ txRaw, endpoint }: { txRaw: string; endpoint: string }) =>
    fetchChain<string>({ url: endpoint, method: 'cfx_sendRawTransaction', params: [txRaw] });

  async signTransaction({ privateKey, transaction }: { privateKey: string; transaction: Transaction }) {
    const wallet = new Wallet(privateKey);
    return wallet.signTransaction(transaction);
  }
}

export default new Transcation();
