import {BSIMError} from './errors';
import {BSIM} from './sdk';

/**
 * get the BSIM version
 * @returns {Promise<string>}
 * @throws {BSIMError} - error
 * @example
 * ```ts
 *  await getVersion() // x.x.x
 * ```
 */

export async function getVersion(): Promise<string> {
  try {
    return await BSIM.getVersion();
  } catch (e: unknown) {
    const error = e as BSIMError;
    throw new BSIMError(error.code, error.message);
  }
}
