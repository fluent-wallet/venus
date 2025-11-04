import type { Address, ChainType, Hash, Hex } from './chain';

/**
 * Minimum data required to build a transaction.
 */
export interface TransactionParams {
  from: Address;
  to: Address;
  value?: string;
  data?: Hex;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

/**
 * Chain-specific transaction data prior to signing.
 */
export interface UnsignedTransaction {
  chainType: ChainType;
  data: unknown;
}

/**
 * Serialized transaction ready for broadcast.
 */
export interface SignedTransaction {
  chainType: ChainType;
  rawTransaction: string;
  hash: Hash;
}

/**
 * Fee estimation information.
 */
export interface FeeEstimate {
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  estimatedTotal: string;
}

/**
 * Transaction lifecycle state.
 */
export enum TxStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
}
