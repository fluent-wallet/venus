import { createPublicClient, http, isAddress, hexToBigInt, encodeFunctionData as viemEncodeFunctionData, type Abi, type BlockTag, signatureToHex } from 'viem';
import { JsonRpcProvider, getBigInt, Transaction, Wallet, Signer, TransactionResponse } from 'ethers';
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

    if (isSendNativeToken) return BigInt(21000 * gasBuffer).toString(16);

    const gas = await fetchChain<string>({
      url: endpoint,
      method: 'cfx_estimateGas',
      params: [
        {
          account: addHexPrefix(tx.from),
          to: addHexPrefix(tx.to),
          value: tx.value,
          data: tx.data ? addHexPrefix(tx.data) : undefined,
        },
        'latest_state',
      ],
    });
    return (BigInt(gas) * BigInt(gasBuffer)).toString(16);
  };

  public estimate = async ({ tx, endpoint, gasBuffer = 1 }: { tx: ITxEvm; endpoint: string; gasBuffer?: number }) => {
    const [gasPrice, gas] = await Promise.all([this.getGasPrice(endpoint), this.estimateGas({ tx, endpoint, gasBuffer })]);
    return { gasPrice, gas };
  };
}

export default new Transcation();
