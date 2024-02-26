import { Network, NetworkType } from '@core/database/models/Network';
import { inject, injectable } from 'inversify';
import { getCurrentNetwork } from '../Plugins/ReactInject/data/useCurrentNetwork';
import { AssetType } from '@core/database/models/Asset';
import { iface1155, iface721, iface777 } from '@core/contracts';
import { firstValueFrom, map, switchMap, defer, from, retry, timeout, tap, catchError, throwError, Subject } from 'rxjs';
import { getCurrentAddress } from '../Plugins/ReactInject/data/useCurrentAddress';
import { addHexPrefix } from '@core/utils/base';
import { computeAddress, parseUnits } from 'ethers';
import { RPCResponse, RPCSend } from '@core/utils/send';
import { Transaction } from 'ethers';
import { Address } from '@core/database/models/Address';
import BSIM, { CoinTypes } from 'packages/WalletCoreExtends/Plugins/BSIM';
import { Signature } from 'ethers';
import { Wallet } from 'ethers';
import { JsonRpcProvider } from 'ethers';
import { GetDecryptedVaultDataMethod } from './getDecryptedVaultData';
import BSIMSDK, { BSIMError, BSIMErrorEndTimeout, BSIM_ERRORS } from 'packages/WalletCoreExtends/Plugins/BSIM/BSIMSDK';
import { Plugins } from '../Plugins';

export enum TxEventTypesName {
  ERROR = 'error',
  GET_NONCE = 'getNonce',

  BSIM_VERIFY_START = 'BSIMVerifyStart',
  BSIM_SIGN_START = 'BSIMSignStart',
  BSIM_TX_SEND = 'BSIMTxSend',
}

export interface TxEvent {
  type: TxEventTypesName;
  message?: string;
  error?: boolean;
  nonce?: string;
}

export interface WalletTransactionType {
  from: string;
  to: string;
  assetType: AssetType;
  balance: string;
  decimals: number;
  symbol: string;
  contractAddress?: string;
  iconUrl?: string;
  amount: string;
  priceInUSDT?: string;
  tokenId?: string; // 721
  tokenImage?: string; // 721
  contractName?: string; // 721
  nftName?: string; // 721
}

@injectable()
export class TransactionMethod {
  @inject(GetDecryptedVaultDataMethod) private GetDecryptedVaultDataMethod!: GetDecryptedVaultDataMethod;
  @inject(Plugins) plugins!: Plugins;

  getTxProvider = (network: Network) => {
    return this.plugins.Transaction.getTxProvider(network);
  };
}
