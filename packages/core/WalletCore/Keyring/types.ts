import type { VaultType } from '../../../core/database/models/Vault/VaultType';

export enum SigningAlgorithm {
  SECP256K1 = 'secp256k1',

  // So we can add more algorithms in the future
}

export interface Signature {
  signature: {
    r: bigint;
    s: bigint;
    recovery?: number;
  };
  publicKey: Uint8Array;
}

export type GetPublicKeyParams =
  | { type: VaultType.PrivateKey; privateKey: Uint8Array; algorithm?: SigningAlgorithm }
  | { type: VaultType.HierarchicalDeterministic; mnemonic: string; basePath: string; index: number; algorithm?: SigningAlgorithm };
export type SignParams =
  | { type: VaultType.PrivateKey; privateKey: Uint8Array; payload: Uint8Array; algorithm?: SigningAlgorithm }
  | { type: VaultType.HierarchicalDeterministic; mnemonic: string; basePath: string; index: number; payload: Uint8Array; algorithm?: SigningAlgorithm };

export interface IKeyring {
  getPublicKey(params: GetPublicKeyParams): Promise<Uint8Array>;
  sign(params: SignParams): Promise<Signature>;
}
