import type { IEncodedTxCfx } from './cfx/types';
import type { IEncodedTxEvm } from './evm/types';

export enum ChainFamily {
  EVM = 'evm',
  CFX = 'cfx',
}

export type IEncodedTx = IEncodedTxEvm | IEncodedTxCfx;

export interface IEncodedTxMap {
  [ChainFamily.EVM]: IEncodedTxEvm;
  [ChainFamily.CFX]: IEncodedTxCfx;
}
