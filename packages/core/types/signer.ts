import type { Address, ChainType, Hex } from './chain';

/**
 * Represents a generic signer instance.
 */
export interface ISigner {
  type: 'software' | 'hardware';
  sign(data: unknown): Promise<string>;
}

/**
 * Describes an account exposed by a hardware wallet.
 */
export interface HardwareAccount {
  index: number;
  address: Address;
  chainType: ChainType;
  publicKey?: Hex;
}

/**
 * Context information required to sign via a hardware wallet.
 */
export interface SigningContext {
  data: unknown;
  derivationPath: string;
  chainType: ChainType;
}

/**
 * Hardware wallet abstraction used by the signer layer.
 */
export interface IHardwareWallet {
  readonly id: string;
  readonly type: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;

  listAccounts(chainType: ChainType): Promise<HardwareAccount[]>;
  deriveAccount(index: number, chainType: ChainType): Promise<HardwareAccount>;
  deriveAddress(path: string, chainType: ChainType): Promise<Address>;

  sign(context: SigningContext): Promise<string>;
}
