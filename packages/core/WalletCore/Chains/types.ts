import type { IConfluxChain, IEncodedTxCfx } from './cfx/types';
import type { IEncodedTxEvm, IEvmChain } from './evm/types';

export const ChainFamily = {
  EVM: 'evm',
  CFX: 'cfx',
} as const;

export type IEncodedTx = IEncodedTxEvm | IEncodedTxCfx;

export interface IEncodedTxMap {
  [ChainFamily.EVM]: IEncodedTxEvm;
  [ChainFamily.CFX]: IEncodedTxCfx;
}

export interface IChain {
  getBalance(address: string): Promise<bigint>;
}

export type ConfluxChainType = IChain & IConfluxChain;

export type EvmChainType = IChain & IEvmChain;
export interface ChainMap {
  [ChainFamily.EVM]: EvmChainType;
  [ChainFamily.CFX]: ConfluxChainType;
}
