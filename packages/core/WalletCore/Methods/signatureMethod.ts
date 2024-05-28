import { inject, injectable } from 'inversify';
import { Plugins } from '../Plugins';
import { createSignature as _createSignature } from '../../database/models/Signature/query';
import { SignatureSubjectValue } from '../Events/broadcastSignatureSubject';
import { Signature } from '@core/database/models/Signature';

@injectable()
export class SignatureMethod {
  @inject(Plugins) plugins!: Plugins;
  async createSignature(params: SignatureSubjectValue, prepareCreate?: true): Promise<Signature> {
    try {
      const { address, app, message, signType } = params;
      const network = await address.network;
      const blockNumber = await this.plugins.BlockNumberTracker.getNetworkBlockNumber(network);
      for (let i = 0; i < 10; i++) {
        await _createSignature(
          {
            address,
            app,
            signType,
            blockNumber,
            message: `${message}-${i}`,
          },
          prepareCreate,
        );
      }
      // TODO: fill params
      return _createSignature(
        {
          address,
          app,
          signType,
          blockNumber,
          message,
        },
        prepareCreate,
      );
    } catch (error) {
      console.error('createSignature error: ', error);
      throw error;
    }
  }
}
