import type { TypedDataDomain, TypedDataField } from 'ethers';
import type { BackupSeedParams, DeriveKeyParams, PubkeyRecord, RestoreSeedParams } from 'react-native-bsim';
import type { Address, ChainType, Hash, Hex } from './chain';
import type { ConfluxUnsignedTransactionPayload, EvmUnsignedTransactionPayload } from './transaction';

export type SignerType = 'software' | 'hardware';

export interface ISoftwareSigner {
  readonly type: 'software';
  getPrivateKey(): string;
}

export interface IHardwareSigner {
  readonly type: 'hardware';
  getDerivationPath(): string;
  getChainType(): ChainType;
  signWithHardware(context: SigningContext): Promise<HardwareSignResult>;
}

export interface SigningContext {
  derivationPath: string;
  chainType: ChainType;
  payload: SigningPayload;
  signal?: AbortSignal;
}

export interface HardwareAccount {
  index: number;
  address: Address;
  chainType: ChainType;
  derivationPath?: string;
  publicKey?: Hex;
}

export interface HardwareWalletCapabilities {
  type: 'bsim';
}

export interface HardwareConnectOptions {
  transport?: 'apdu' | 'ble';
  deviceIdentifier?: string;
  signal?: AbortSignal;
}

export interface HardwareOperationOptions {
  signal?: AbortSignal;
}

export interface IHardwareWallet {
  readonly id: string;
  readonly type: string;

  connect(options?: HardwareConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;

  listAccounts(chainType: ChainType): Promise<HardwareAccount[]>;
  deriveAccount(index: number, chainType: ChainType): Promise<HardwareAccount>;
  deriveAddress(path: string, chainType: ChainType): Promise<Address>;

  sign(context: SigningContext): Promise<HardwareSignResult>;
  getCapabilities(): HardwareWalletCapabilities;
}

export type SigningPayload =
  | {
      payloadKind: 'transaction';
      chainType: ChainType;
      unsignedTx: ConfluxUnsignedTransactionPayload | EvmUnsignedTransactionPayload;
      digest?: Hex;
      context?: Record<string, unknown>;
    }
  | {
      payloadKind: 'message';
      messageKind: 'personal';
      chainType: ChainType;
      message: string;
    }
  | {
      payloadKind: 'message';
      messageKind: 'typedData';
      chainType: ChainType;
      domain: TypedDataDomain;
      types: Record<string, TypedDataField[]>;
      message: Record<string, unknown>;
    }
  | {
      payloadKind: 'raw';
      chainType: ChainType;
      data: Hex;
    };

export type HardwareSignResult =
  | { resultType: 'signature'; chainType: ChainType; r: Hex; s: Hex; v: number; digest?: Hex }
  | { resultType: 'rawTransaction'; chainType: ChainType; rawTransaction: Hex; hash: Hash }
  | { resultType: 'typedSignature'; chainType: ChainType; signature: string };

export type ISigner = ISoftwareSigner | IHardwareSigner;

export interface IBSIMWallet extends IHardwareWallet {
  verifyBpin(options?: HardwareOperationOptions): Promise<void>;
  updateBpin(options?: HardwareOperationOptions): Promise<'ok'>;
  getIccid(options?: HardwareOperationOptions): Promise<string>;
  getVersion(options?: HardwareOperationOptions): Promise<string>;
  backupSeed(params: BackupSeedParams, options?: HardwareOperationOptions): Promise<string>;
  restoreSeed(params: RestoreSeedParams, options?: HardwareOperationOptions): Promise<'ok'>;
  exportPubkeys(options?: HardwareOperationOptions): Promise<PubkeyRecord[]>;
  deriveKey(params: DeriveKeyParams, options?: HardwareOperationOptions): Promise<void>;
}
