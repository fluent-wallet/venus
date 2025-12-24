import type { Address, AssetType, Hex, TxStatus } from '@core/types';
import type { EvmRpcTransactionRequest } from './dappTypes';

export interface TransactionFilter {
  addressId: string;
  status?: 'pending' | 'finished' | 'all';
  limit?: number;
}

export interface RecentlyAddress {
  addressValue: Address;
  direction: 'inbound' | 'outbound';
  isLocalAccount: boolean;
  lastUsedAt: number;
}

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

  signal?: AbortSignal;
}

export interface SendERC20Input {
  addressId: string;
  contractAddress: Address;
  to: Address;
  amount: string;
  assetDecimals: number;

  signal?: AbortSignal;
}

export interface EstimateDappTransactionInput {
  addressId: string;
  request: EvmRpcTransactionRequest;
  signal?: AbortSignal;
}

export interface SendDappTransactionInput {
  addressId: string;
  request: EvmRpcTransactionRequest;
  signal?: AbortSignal;
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
