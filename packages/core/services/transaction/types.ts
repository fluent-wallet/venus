import type { Address, Hex } from '@core/types';
import { AssetType, TxStatus } from '@core/types';

export interface SendTransactionInput {
  addressId: string;
  to: Address;
  amount: string;
  assetType: AssetType;
  assetDecimals: number;
  contractAddress?: Address;
  nftTokenId?: string;
  data?: Hex;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  storageLimit?: string;
}

export interface SendERC20Input {
  addressId: string;
  contractAddress: Address;
  to: Address;
  amount: string;
  assetDecimals: number;
}

/**
 * Plain transaction snapshot for UI
 */
export interface ITransaction {
  id: string;
  hash: string;
  from: Address;
  to: Address;
  value: string;
  status: TxStatus;
  timestamp: number;
  networkId: string;
}
