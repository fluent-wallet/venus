import type { Address, AssetType, Hex, TxStatus } from '@core/types';
import type { EvmRpcTransactionRequest } from './dappTypes';

export interface TransactionFilter {
  addressId: string;
  status?: 'pending' | 'finished' | 'all';
  limit?: number;
}

export type GasEstimateLevel = 'low' | 'medium' | 'high';

export type LegacyLikeGasEstimate = {
  gasLimit: Hex;
  gasPrice: Hex;
  storageLimit?: Hex;
  estimate?: Record<GasEstimateLevel, { suggestedGasPrice: Hex; gasCost: Hex }>;
  estimateOf1559?: Record<GasEstimateLevel, { suggestedMaxFeePerGas: Hex; suggestedMaxPriorityFeePerGas: Hex; gasCost: Hex }>;
  nonce: number;
};

export type GasPricingEstimate = {
  gasLimit: Hex;
  storageLimit?: Hex;
  gasPrice: Hex;
  constraints: {
    minGasPriceWei: Hex;
  };
  pricing:
    | { kind: 'legacy'; levels: Record<GasEstimateLevel, { gasPrice: Hex; gasCost: Hex }> }
    | { kind: 'eip1559'; levels: Record<GasEstimateLevel, { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex; gasCost: Hex }> };
  nonce: number;
};

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

  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  storageLimit?: string;

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
