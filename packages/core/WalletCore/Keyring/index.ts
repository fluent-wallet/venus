import type { IPlugin } from '../plugin';
import { SERVICE_IDENTIFIER } from '../service';
import { KeyringServer } from './server';

export const KeyringPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.KEYRING,

  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.KEYRING).to(KeyringServer).inSingletonScope();
  },
};
