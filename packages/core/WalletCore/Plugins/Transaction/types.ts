import type { AssetType } from '@core/database/models/Asset';

export type ITxEvm = {
  from: string;
  to: string;
  value: string;
  data?: string;

  nonce?: number;
  type?: number;
  chainId?: string;

  gasLimit?: string;
  gasPrice?: string;
  storageLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

export enum IBSIMTxEventTypesName {
  ERROR = 'error',
  GET_NONCE = 'getNonce',
  BSIM_VERIFY_START = 'BSIMVerifyStart',
  BSIM_SIGN_START = 'BSIMSignStart',
  BSIM_TX_SEND = 'BSIMTxSend',
}

export interface IBSIMTxEvent {
  type: IBSIMTxEventTypesName;
  message?: string;
  error?: boolean;
  nonce?: number;
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
