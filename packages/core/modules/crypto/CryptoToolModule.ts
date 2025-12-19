import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeModule } from '@core/runtime/types';
import type { CryptoTool } from '@core/types/crypto';

export type CryptoToolModuleOptions = {
  cryptoTool: CryptoTool;
};

export const createCryptoToolModule = (options: CryptoToolModuleOptions): RuntimeModule => {
  return {
    id: 'crypto-tool',
    register: ({ container }) => {
      if (container.isBound(CORE_IDENTIFIERS.CRYPTO_TOOL)) return;
      container.bind(CORE_IDENTIFIERS.CRYPTO_TOOL).toConstantValue(options.cryptoTool);
    },
  };
};
