import {BSIMError, ErrorVerifyBPIN} from './errors';
import {BSIM} from './sdk';

export type VerifyBPINErrorType = ErrorVerifyBPIN | BSIMError;

/**
 * require the verification of the BPIN
 * This function just call the user verify BPIN UI, it does't know return the BPIN verification result,
 * So we can't to know the BPIN verification result and it is successful or not
 * @throws {BSIMError | ErrorVerifyBPIN} - error
 * @returns {Promise<string>}
 * @example
 * ```ts
 * await verifyBPIN()
 * ```
 */
export async function verifyBPIN(): Promise<string> {
  try {
    const result = await BSIM.verifyBPIN();
    return result;
  } catch (e: unknown) {
    const error = e as BSIMError;

    if (error?.code === ErrorVerifyBPIN.code) {
      throw new ErrorVerifyBPIN(error.code, error.message);
    }
    throw new BSIMError(error.code, error.message);
  }
}
