import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeModule } from '@core/runtime/types';
import type { CryptoTool } from '@core/types/crypto';
import { CRYPTO_TOOL_MODULE_ID } from '../ids';

export type CryptoToolModuleOptions = {
  cryptoTool: CryptoTool;
};

export const createCryptoToolModule = (options: CryptoToolModuleOptions): RuntimeModule => {
  return {
    id: CRYPTO_TOOL_MODULE_ID,
    register: ({ container }) => {
      if (container.isBound(CORE_IDENTIFIERS.CRYPTO_TOOL)) return;
      container.bind(CORE_IDENTIFIERS.CRYPTO_TOOL).toConstantValue(options.cryptoTool);
    },
  };
};
