import type { FeeEstimate, SignedTransaction, TransactionParams, TxStatus, UnsignedTransaction } from './transaction';
import { NetworkType as CoreNetworkType } from '@core/utils/consts';

export type ChainType = CoreNetworkType;
export type Hex = `0x${string}`;
export type Address = string;
export type Hash = string;

/**
 * Parameters for the `call` method
 */
export interface ChainCallParams {
  to: Address;
  data: Hex;
}

/**
 * Abstraction for chain-specific operations
 */
export interface IChainProvider {
  readonly chainId: string;
  readonly networkType: ChainType;

  deriveAddress(publicKey: Hex, params?: unknown): string;
  validateAddress(address: Address): boolean;

  buildTransaction(params: TransactionParams): Promise<UnsignedTransaction>;
  estimateFee(tx: UnsignedTransaction): Promise<FeeEstimate>;
  signTransaction(tx: UnsignedTransaction, signer: unknown): Promise<SignedTransaction>;
  broadcastTransaction(signedTx: SignedTransaction): Promise<Hash>;

  getBalance(address: Address): Promise<Hex>;
  call(params: ChainCallParams): Promise<Hex>;
  getNonce(address: Address): Promise<number>;

  signMessage(message: string, signer: unknown): Promise<string>;
  verifyMessage(message: string, signature: string, address: Address): boolean;
}

/**
 * Registry for chain providers.
 */
export interface IChainRegistry {
  register(provider: IChainProvider): void;
  get(chainId: string, networkType?: ChainType): IChainProvider | undefined;
  getByType(chainType: ChainType): IChainProvider[];
  has(chainId: string, networkType?: ChainType): boolean;
  getAll(): IChainProvider[];
}

export const NetworkType = CoreNetworkType;
