import type { Logger } from '@core/runtime/types';

export const createSilentLogger = (): Logger => {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
};
