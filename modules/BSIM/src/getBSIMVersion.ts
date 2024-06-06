import {BSIMError, ErrorGetBSIMVersion} from './errors';
import {BSIM} from './sdk';

/**
 * get the BSIM Verison
 *
 * @return {Promise<string>} -x.x.x
 * @throws {BSIMError | ErrorGetBSIMVersion} - error
 * @example
 * ```ts
 * await getBSIMVersion() // 0000
 * ```
 */

export type GetBSIMVersionErrorType = ErrorGetBSIMVersion | BSIMError;
export async function getBSIMVersion(): Promise<string> {
  try {
    return await BSIM.getBSIMVersion();
  } catch (e: unknown) {
    const error = e as BSIMError;
    if (error?.code === ErrorGetBSIMVersion.code) {
      throw new ErrorGetBSIMVersion(error.code, error.message);
    }

    throw new BSIMError(error.code, error.message);
  }
}
