import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import type { IPlugin } from '../../../core/WalletCore/plugin';
import { CryptoToolServer } from './cryptoToolServer';

export const CryptoToolPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.CRYPTO_TOOL,
  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.CRYPTO_TOOL).to(CryptoToolServer).inSingletonScope();
  },
};
