import type { Hex } from 'ox/Hex';
import type { IEncodedTxEvm } from '../Chains/evm/types';
import type { IEvmSoftwareSigner } from './types';
import { injectable } from 'inversify';

@injectable()
export class EvmSoftwareSigner implements IEvmSoftwareSigner {
  getAddress(): Promise<Hex> {
    // TODO
    throw new Error('Method not implemented.');
  }

  getPublicKey(): Promise<Hex> {
    // TODO
    throw new Error('Method not implemented.');
  }

  signTransaction(tx: IEncodedTxEvm): Promise<Hex> {
    // TODO

    throw new Error('Method not implemented.');
  }

  signMessage(message: Hex): Promise<Hex> {
    // TODO

    throw new Error('Method not implemented.');
  }
}
