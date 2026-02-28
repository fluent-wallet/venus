import type { NetworkType } from '@core/utils/consts';
import type { AssetType } from './asset';
import type { Address, ChainType, Hash, Hex } from './chain';

/**
 * Minimum data required to build a transaction.
 */
export interface TransactionParams {
  from: Address;
  to: Address;
  chainId: string;

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
  storageLimit?: string;
  epochHeight?: number;
  nonce?: number;
}

interface BaseUnsignedTransaction<TChain extends ChainType> {
  chainType: TChain;
  context?: Record<string, unknown>;
}

export interface ConfluxUnsignedTransactionPayload {
  from: Address;
  to?: Address;
  chainId: string;
  value: Hex;
  data: Hex;
  gasLimit?: string;
  gasPrice?: string;
  storageLimit?: string;
  nonce?: number;
  epochHeight?: number;
}

export interface ConfluxUnsignedTransaction extends BaseUnsignedTransaction<NetworkType.Conflux> {
  payload: ConfluxUnsignedTransactionPayload;
}

export interface EvmUnsignedTransactionPayload {
  from: Address;
  to?: Address;
  chainId: string;
  value: Hex;
  data: Hex;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  type?: number;
}

export interface EvmUnsignedTransaction extends BaseUnsignedTransaction<NetworkType.Ethereum> {
  payload: EvmUnsignedTransactionPayload;
}

export interface GenericUnsignedTransaction<TChain extends ChainType = ChainType> extends BaseUnsignedTransaction<TChain> {
  payload: Record<string, unknown>;
}

export type UnsignedTransaction = ConfluxUnsignedTransaction | EvmUnsignedTransaction | GenericUnsignedTransaction;

/**
 * Serialized transaction ready for broadcast.
 */
export interface SignedTransaction<TChain extends ChainType = ChainType> {
  chainType: TChain;
  rawTransaction: string;
  hash: Hash;
  metadata?: Record<string, unknown>;
}

interface BaseFeeEstimate<TChain extends ChainType> {
  chainType: TChain;
  estimatedTotal: string;
  gasLimit: string;
}

export interface ConfluxFeeEstimate extends BaseFeeEstimate<NetworkType.Conflux> {
  gasPrice: string;
  storageLimit: string;
}

export interface EvmFeeEstimate extends BaseFeeEstimate<NetworkType.Ethereum> {
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface GenericFeeEstimate<TChain extends ChainType = ChainType> extends BaseFeeEstimate<TChain> {
  details?: Record<string, unknown>;
}

export type FeeEstimate = ConfluxFeeEstimate | EvmFeeEstimate | GenericFeeEstimate;

/**
 * Transaction lifecycle state.
 */
export enum TxStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

export type SpeedUpAction = 'SpeedUp' | 'Cancel';

export const TX_STATUS = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Failed: 'failed',
} as const;

export type TxStatusValue = (typeof TX_STATUS)[keyof typeof TX_STATUS];

export const SPEED_UP_ACTION = {
  SpeedUp: 'SpeedUp',
  Cancel: 'Cancel',
} as const;

export type SpeedUpActionValue = (typeof SPEED_UP_ACTION)[keyof typeof SPEED_UP_ACTION];
