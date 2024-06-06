import {BSIMError, ErrorUpdateBPIN} from './errors';
import {BSIM} from './sdk';

export type UpdateBPINErrorType = ErrorUpdateBPIN | BSIMError;

/**
 * update the BPIN
 * This function just call the user update BPIN UI, it does't know return the BPIN update result,
 * So we can't to know the BPIN update result and it is successful or not
 * @throws {UpdateBPINErrorType}
 * @returns
 */
export async function updateBPIN(): Promise<string> {
  try {
    const result = await BSIM.updateBPIN();
    return result;
  } catch (e: unknown) {
    const error = e as BSIMError;
    if (error.code === ErrorUpdateBPIN.code) {
      throw new ErrorUpdateBPIN(error.code, error.message);
    }
    throw new BSIMError(error.code, error.message);
  }
}
