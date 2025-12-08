import { BSIM_ERROR_CANCEL, BSIM_ERRORS } from '../constants';

/**
 * Custom error class for BSIM hardware wallet errors
 */
export class BSIMHardwareError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BSIMHardwareError';
  }
}

/**
 * Creates an abort error with standard code
 */
export const createAbortError = () => new BSIMHardwareError(BSIM_ERROR_CANCEL, BSIM_ERRORS[BSIM_ERROR_CANCEL]);

/**
 * Checks if signal is aborted and throws if so
 */
export const assertAbortable = (signal?: AbortSignal) => {
  if (signal?.aborted) throw createAbortError();
};
