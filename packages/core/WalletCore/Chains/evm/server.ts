import { injectable } from 'inversify';
import type { IChain } from '../types';
import type { IEncodedTxEvm, IEvmChain } from './types';

@injectable()
export class EvmChainServer implements IChain, IEvmChain {
  async getBalance(address: string): Promise<bigint> {
    throw new Error('Method not implemented.');
  }

  async buildTransaction(tx: IEncodedTxEvm): Promise<IEncodedTxEvm> {
    throw new Error('Method not implemented.');
  }
}
