import type { VaultType } from '../../../core/database/models/Vault/VaultType';
import type { Hex } from 'ox/Hex';

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
  publicKey: Hex;
}

export type GetPublicKeyParams =
  | { type: VaultType.PrivateKey; privateKey: Hex; algorithm?: SigningAlgorithm }
  | { type: VaultType.HierarchicalDeterministic; mnemonic: string; basePath: string; index: number; algorithm?: SigningAlgorithm };
export type SignParams =
  | { type: VaultType.PrivateKey; privateKey: Hex; payload: Uint8Array; algorithm?: SigningAlgorithm }
  | { type: VaultType.HierarchicalDeterministic; mnemonic: string; basePath: string; index: number; payload: Uint8Array; algorithm?: SigningAlgorithm };

export interface IKeyring {
  getPublicKey(params: GetPublicKeyParams): Promise<Hex>;
  sign(params: SignParams): Promise<Signature>;
}
