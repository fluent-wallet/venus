import { Network, NetworkType } from '@core/database/models/Network';
import { inject, injectable } from 'inversify';
import { getCurrentNetwork } from '../Plugins/ReactInject/data/useCurrentNetwork';
import { AssetType } from '@core/database/models/Asset';
import { WalletTransactionType } from '../Plugins/ReactInject/data/useTransaction';
import { iface1155, iface721, iface777 } from '@core/contracts';
import { firstValueFrom, map, switchMap, defer, from, retry, timeout, Subject, tap, catchError, throwError } from 'rxjs';
import { getCurrentAddress } from '../Plugins/ReactInject/data/useCurrentAddress';
import { addHexPrefix } from '@core/utils/base';
import { parseUnits } from 'ethers';
import { RPCResponse, RPCSend } from '@core/utils/send';
import { Transaction } from 'ethers';
import { Address } from '@core/database/models/Address';
import BSIM, { CoinTypes } from 'packages/WalletCoreExtends/Plugins/BSIM';
import { Signature } from 'ethers';
import { Wallet } from 'ethers';
import { JsonRpcProvider } from 'ethers';
import { GetDecryptedVaultDataMethod } from './getDecryptedVaultData';
import { BSIMErrorEndTimeout } from 'packages/WalletCoreExtends/Plugins/BSIM/BSIMSDK';

@injectable()
export class TransactionMethod {
  @inject(GetDecryptedVaultDataMethod) private GetDecryptedVaultDataMethod!: GetDecryptedVaultDataMethod;
  private checkNetwork = (network: Network | null) => {
    if (!network) {
      return false;
    }
    if (network.networkType === NetworkType.Ethereum) {
      return true;
    }
    return false;
  };

  private getNonce = (endpoint: string, currentAddress: string) => {
    return firstValueFrom(RPCSend<RPCResponse<string>>(endpoint, { method: 'eth_getTransactionCount', params: [currentAddress, 'pending'] }));
  };

  private getContractTransactionData = (
    currentAddress: string,
    args: Pick<WalletTransactionType, 'assetType' | 'tokenId' | 'contractAddress' | 'to' | 'amount' | 'decimals'>
  ) => {
    if (!args.contractAddress) {
      throw new Error("Get contract transaction data but don't have contract address");
    }

    switch (args.assetType) {
      case AssetType.ERC20: {
        return iface777.encodeFunctionData('transfer', [args.to, args.amount]);
      }
      case AssetType.ERC721: {
        if (typeof args.tokenId === 'undefined') {
          throw new Error("Get ERC721 transaction data but don't have tokenId");
        }
        return iface721.encodeFunctionData('transferFrom', [currentAddress, args.to, args.tokenId]);
      }
      case AssetType.ERC1155: {
        if (typeof args.tokenId === 'undefined') {
          throw new Error("Get ERC1155 transaction data but don't have tokenId");
        }

        return iface1155.encodeFunctionData('safeTransferFrom', [currentAddress, args.to, args.tokenId, args.amount, '0x']);
      }

      default: {
        throw new Error(`Get contract transaction data , only support ERC20, ERC721, ERC1155, but get assetType: ${args.assetType}`);
      }
    }
  };

  signAndSendTransaction = async (endpoint: string, currentAddress: Address, transaction: Transaction, BSIMChannel?: Subject<void>) => {
    const vaultType = await currentAddress.getVaultType();

    if (vaultType === 'BSIM') {
      const hash = transaction.unsignedHash;
      const index = (await currentAddress.account).index;

      if (BSIMChannel) {
        BSIMChannel.next();
      }

      await BSIM.verifyBPIN();

      let errorMsg = '';
      let errorCode = '';
      // retrieve the R S V of the transaction through a polling mechanism
      const res = await firstValueFrom(
        defer(() => from(BSIM.signMessage(hash, CoinTypes.CONFLUX, index))).pipe(
          catchError((err: { code: string; message: string }) => {
            errorMsg = err.message;
            errorCode = err.code;
            return throwError(() => err);
          }),
          retry({ delay: 1000 }),
          timeout({ each: 30 * 1000, with: () => throwError(() => new BSIMErrorEndTimeout(errorCode, errorMsg)) })
        )
      );
      //  add the R S V to the transaction
      transaction.signature = Signature.from({ r: res.r, s: res.s, v: res.v });
      // get the transaction encoded
      const encodeTx = transaction.serialized;
      const txRes = await firstValueFrom(RPCSend<RPCResponse<string>>(endpoint, { method: 'eth_sendRawTransaction', params: [encodeTx] }));

      if (BSIMChannel) {
        BSIMChannel.next();
      }

      return { txHash: txRes.result, error: txRes.error, txRaw: encodeTx };
    } else {
      const pk = await this.GetDecryptedVaultDataMethod.getPrivateKeyOfAddress(currentAddress);
      const wallet = new Wallet(pk, new JsonRpcProvider(endpoint));
      const encodeTx = await wallet.signTransaction(transaction);
      const txRes = await firstValueFrom(RPCSend<RPCResponse<string>>(endpoint, { method: 'eth_sendRawTransaction', params: [encodeTx] }));
      return { txHash: txRes.result, error: txRes.error, txRaw: encodeTx };
    }
  };

  getGasPriceAndLimit = async (args: Pick<WalletTransactionType, 'to' | 'assetType' | 'amount' | 'contractAddress' | 'tokenId' | 'decimals'>) => {
    const currentNetwork = getCurrentNetwork();
    const currentAddress = getCurrentAddress();
    if (!currentAddress) {
      throw new Error("Can't get current address");
    }

    if (!currentNetwork) {
      throw new Error("Can't get current network");
    }
    if (!this.checkNetwork(currentNetwork)) {
      throw new Error('Network is not supported');
    }

    const estimateGasParams: { from: string; nonce: null | string | null; to: string | null; data?: string; value?: string } = {
      from: currentAddress.hex,
      nonce: null,
      to: null,
    };
    if (args.assetType === AssetType.Native) {
      estimateGasParams.to = args.to;
      estimateGasParams.data = '0x';
      estimateGasParams.value = addHexPrefix(args.amount.toString(16));
    } else {
      if (typeof args.contractAddress === 'undefined') {
        throw new Error("Get gas price and limit but don't have contract address");
      }
      estimateGasParams.to = args.contractAddress;
      estimateGasParams.data = this.getContractTransactionData(currentAddress.hex, args);
    }
    return firstValueFrom(
      RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getTransactionCount', params: [currentAddress.hex, 'pending'] }).pipe(
        timeout(30 * 1000),
        map((res) => res.result),
        switchMap((nonce) => {
          estimateGasParams.nonce = nonce;
          return RPCSend<RPCResponse<string>[]>(currentNetwork.endpoint, [
            {
              method: 'eth_estimateGas',
              params: [estimateGasParams],
            },
            { method: 'eth_gasPrice' },
          ]);
        }),
        map(([gas, gasPrice]) => ({ gasLimit: gas, gasPrice: gasPrice }))
      )
    );
  };

  sendTransaction = async (walletTx: WalletTransactionType, gas: { gasLimit: string; gasPrice: string }, BSIMChannel?: Subject<void>) => {
    const currentNetwork = getCurrentNetwork();
    const currentAddress = getCurrentAddress();
    if (!currentAddress) {
      throw new Error("Can't get current address");
    }

    if (!currentNetwork) {
      throw new Error("Can't get current network");
    }
    const transaction = new Transaction();

    transaction.chainId = currentNetwork.chainId;

    transaction.gasLimit = gas.gasLimit;
    transaction.gasPrice = gas.gasPrice;
    transaction.type = 0;

    const nonce = await this.getNonce(currentNetwork.endpoint, currentAddress.hex);
    transaction.nonce = nonce.result;

    if (walletTx.assetType === AssetType.Native) {
      transaction.to = walletTx.to;
      transaction.value = walletTx.amount;
    } else {
      if (typeof walletTx.contractAddress === 'undefined') {
        throw new Error("Send contract transaction but don't have contract address");
      }
      transaction.to = walletTx.contractAddress;
      transaction.data = this.getContractTransactionData(currentAddress.hex, walletTx);
    }
    const { txHash, txRaw, error } = await this.signAndSendTransaction(currentNetwork.endpoint, currentAddress, transaction, BSIMChannel);

    return { txHash, txRaw, transaction, error };
  };
}
