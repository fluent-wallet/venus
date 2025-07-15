import type { IPlugin } from '../plugin';
import { SERVICE_IDENTIFIER } from '../service';
import { ConfluxChainServer } from './cfx/server';
import { EvmChainServer } from './evm/server';

export const ChainPlugin: IPlugin = {
  name: 'ChainPlugin',

  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.CONFLUX_CHAIN).to(ConfluxChainServer).inSingletonScope();
    context.container.bind(SERVICE_IDENTIFIER.EVM_CHAIN).to(EvmChainServer).inSingletonScope();
  },
};
