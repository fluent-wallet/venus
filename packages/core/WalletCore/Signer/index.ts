import type { IPlugin } from '../plugin';
import { SERVICE_IDENTIFIER } from '../service';
import { EvmSoftwareSigner } from './EvmSoftwareSigner';
import type { ICfxSoftwareSigner, IEvmSoftwareSigner, SOFTWARE_SIGNER_TYPE } from './types';
import { CfxSoftwareSigner } from './CfxSoftwareSigner';
import type { Hex } from 'ox/Hex';

export const SignerPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.SIGNER_FACTORY,
  install(context) {
    context.container.bind<IEvmSoftwareSigner>(SERVICE_IDENTIFIER.EVM_SOFTWARE_SIGNER).toConstructor(EvmSoftwareSigner);
    context.container.bind<ICfxSoftwareSigner>(SERVICE_IDENTIFIER.CFX_SOFTWARE_SIGNER).toConstructor(CfxSoftwareSigner);
    

    context.container.bind(SERVICE_IDENTIFIER.SIGNER_FACTORY).toFactory(() => {
      return (type: keyof typeof SOFTWARE_SIGNER_TYPE, privateKey: Hex) => {
        switch (type) {
          case 'EVM': {
            const EvmSignerConstructor = context.container.get<typeof EvmSoftwareSigner>(SERVICE_IDENTIFIER.EVM_SOFTWARE_SIGNER);
            return new EvmSignerConstructor(privateKey);
          }
          case 'CFX': {
            const CfxSignerConstructor = context.container.get<typeof CfxSoftwareSigner>(SERVICE_IDENTIFIER.CFX_SOFTWARE_SIGNER);
            return new CfxSignerConstructor(privateKey);
          }
          default:
            throw new Error(`Unsupported signer type: ${type}`);
        }
      };
    });
  },
};
