import { inject, injectable } from 'inversify';
import { Plugins } from '../Plugins';
import { createSignature as _createSignature } from '../../database/models/Signature/query';
import { Signature } from '@core/database/models/Signature';
import { Address } from '@core/database/models/Address';
import { App } from '@core/database/models/App';
import { SignType } from '@core/database/models/Signature/type';

interface CreateSignatureParams {
  address: Address;
  app?: App;
  signType: SignType;
  message?: string | null;
}

@injectable()
export class SignatureMethod {
  @inject(Plugins) plugins!: Plugins;
  async createSignature(params: CreateSignatureParams): Promise<Signature> {
    try {
      const { address, app, message, signType } = params;
      const network = await address.network;
      const blockNumber = await this.plugins.BlockNumberTracker.getNetworkBlockNumber(network);
      return _createSignature({
        address,
        app,
        signType,
        blockNumber,
        message,
      });
    } catch (error) {
      console.error('createSignature error: ', error);
      throw error;
    }
  }
}
