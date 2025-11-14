import type { IPlugin } from '../../../core/WalletCore/plugin';
import { CryptoToolServer } from './cryptoToolServer';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';

export const CryptoToolPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.CRYPTO_TOOL,
  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.CRYPTO_TOOL).to(CryptoToolServer).inSingletonScope();
  },
};
