import type { Hex } from 'ox/Hex';
import type { IEncodedTxEvm } from '../Chains/evm/types';
import type { ICfxSoftwareSigner } from './types';
import { injectable } from 'inversify';
import type { IEncodedTxCfx } from '../Chains/cfx/types';

@injectable()
export class CfxSoftwareSigner implements ICfxSoftwareSigner {
  getAddress(): Promise<Hex> {
    // TODO
    throw new Error('Method not implemented.');
  }

  getPublicKey(): Promise<Hex> {
    // TODO
    throw new Error('Method not implemented.');
  }

  signTransaction(tx: IEncodedTxCfx): Promise<Hex> {
    // TODO

    throw new Error('Method not implemented.');
  }

  signMessage(message: Hex): Promise<Hex> {
    // TODO

    throw new Error('Method not implemented.');
  }
}
