import type { Hex } from 'ox/Hex';
import type { IEncodedTxEvm } from '../Chains/evm/types';
import type { IEncodedTxCfx } from '../Chains/cfx/types';

export interface ISigner<Address, Pubkey> {
  getAddress(): Promise<Address>;

  getPublicKey(): Promise<Pubkey>;
}

export interface IEvmSoftwareSigner extends ISigner<Hex, Hex> {
  signTransaction(tx: IEncodedTxEvm): Promise<Hex>;
  signMessage(message: Hex): Promise<Hex>;
}

export interface ICfxSoftwareSigner extends ISigner<Hex, Hex> {
  signTransaction(tx: IEncodedTxCfx): Promise<Hex>;
  signMessage(message: Hex): Promise<Hex>;
}

export const SOFTWARE_SIGNER_TYPE = {
  EVM: 'EVM',
  CFX: 'CFX',
} as const;

export interface ISupportSoftwareSigner {
  [SOFTWARE_SIGNER_TYPE.EVM]: IEvmSoftwareSigner;
  [SOFTWARE_SIGNER_TYPE.CFX]: ICfxSoftwareSigner;
}

export type SoftwareSignerFactory = <T extends keyof ISupportSoftwareSigner>(type: T, privateKey: Hex) => ISupportSoftwareSigner[T];
