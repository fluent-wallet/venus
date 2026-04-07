import { NetworkType as CoreNetworkType } from '@core/utils/consts';
import type { Block, Hex } from 'ox';
import type { AssetType } from './asset';
import type { IChainRpc } from './rpc';
import type { ISigner } from './signer';
import type {
  ConfluxFeeEstimate,
  ConfluxUnsignedTransaction,
  EvmFeeEstimate,
  EvmUnsignedTransaction,
  FeeEstimate,
  SignedTransaction,
  TransactionParams,
  UnsignedTransaction,
} from './transaction';

export type ChainType = CoreNetworkType;
export type Hex = Hex.Hex;
export type Address = string;
export type Hash = Block.Hash;

/**
 * Parameters for the `call` method
 */
export interface ChainCallParams {
  to: Address;
  data: Hex;
}

export type FungibleAssetBalanceRequest =
  | {
      assetType: AssetType.Native;
    }
  | {
      assetType: AssetType.ERC20;
      contractAddress: Address;
    };

export interface IChainProvider<TUnsignedTransaction extends UnsignedTransaction = UnsignedTransaction, TFeeEstimate extends FeeEstimate = FeeEstimate> {
  readonly chainId: string;
  readonly networkType: ChainType;
  readonly rpc: IChainRpc;

  deriveAddress(publicKey: Hex, params?: unknown): string;
  validateAddress(address: Address): boolean;

  prepareUnsignedTransaction(tx: TUnsignedTransaction): Promise<TUnsignedTransaction>;
  buildTransaction(params: TransactionParams): Promise<TUnsignedTransaction>;
  estimateFee(tx: TUnsignedTransaction): Promise<TFeeEstimate>;
  signTransaction(tx: TUnsignedTransaction, signer: ISigner, options?: { signal?: AbortSignal }): Promise<SignedTransaction<TUnsignedTransaction['chainType']>>;
  broadcastTransaction(signedTx: SignedTransaction): Promise<Hash>;

  getBalance(address: Address): Promise<Hex>;
  call(params: ChainCallParams): Promise<Hex>;
  batchCall(params: readonly ChainCallParams[]): Promise<Hex[]>;
  readFungibleAssetBalances(address: Address, requests: readonly FungibleAssetBalanceRequest[]): Promise<ReadonlyArray<Hex | null>>;
  getNonce(address: Address): Promise<number>;

  signMessage(message: string, signer: ISigner): Promise<string>;
  verifyMessage(message: string, signature: string, address: Address): boolean;
}

export type AnyChainProvider = IChainProvider<any, any>;
export type EvmChainProviderLike = IChainProvider<EvmUnsignedTransaction, EvmFeeEstimate>;
export type ConfluxChainProviderLike = IChainProvider<ConfluxUnsignedTransaction, ConfluxFeeEstimate>;

/**
 * Registry for chain providers.
 */
export interface IChainRegistry {
  register(provider: AnyChainProvider): void;
  get<TProvider extends AnyChainProvider = AnyChainProvider>(chainId: string, networkType?: ChainType): TProvider | undefined;
  getByType<TProvider extends AnyChainProvider = AnyChainProvider>(chainType: ChainType): TProvider[];
  has(chainId: string, networkType?: ChainType): boolean;
  getAll(): AnyChainProvider[];
}

export const NetworkType = CoreNetworkType;
