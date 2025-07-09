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
