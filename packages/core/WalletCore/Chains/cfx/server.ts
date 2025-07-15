import { inject, injectable } from 'inversify';
import type { IChain } from '../types';
import type { IConfluxChain, IEncodedTxCfx } from './types';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';

@injectable()
export class ConfluxChainServer implements IChain, IConfluxChain {
  async getBalance(address: string): Promise<bigint> {
    throw new Error('Method not implemented.');
  }

  async buildTransaction(tx: IEncodedTxCfx): Promise<IEncodedTxCfx> {
    throw new Error('Method not implemented.');
  }
}
