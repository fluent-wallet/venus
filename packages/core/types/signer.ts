import type { Address, ChainType, Hex } from './chain';

export type SignerType = 'software' | 'hardware';

export interface ISoftwareSigner {
  readonly type: 'software';
  getPrivateKey(): string;
}

export interface IHardwareSigner {
  readonly type: 'hardware';
  getDerivationPath(): string;
  getChainType(): ChainType;
  signWithHardware(context: SigningContext): Promise<string>;
}

export type ISigner = ISoftwareSigner | IHardwareSigner;

export interface SigningContext {
  data: unknown;
  derivationPath: string;
  chainType: ChainType;
}

export interface HardwareAccount {
  index: number;
  address: Address;
  chainType: ChainType;
  publicKey?: Hex;
}

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
