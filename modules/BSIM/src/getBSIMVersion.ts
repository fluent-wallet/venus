import { type BSIMError, ErrorGetBSIMVersion } from './errors';
import { getWallet } from './walletInstance';
import { TransportError } from './transports/errors';

export type GetBSIMVersionErrorType = ErrorGetBSIMVersion | BSIMError | TransportError;

/**
 * get the BSIM Verison
 * @deprecated
 * @return {Promise<string>} -x.x.x
 * @throws {BSIMError | ErrorGetBSIMVersion} - error
 * @example
 * ```ts
 * await getBSIMVersion() // 0000
 * ```
 */

export async function getBSIMVersion(): Promise<string> {
  try {
    return await getWallet().getVersion();
  } catch (error) {
    if (error instanceof ErrorGetBSIMVersion || error instanceof TransportError) {
      throw error;
    }
    const bsimError = error as BSIMError | undefined;
    if (bsimError?.code) {
      throw new ErrorGetBSIMVersion(bsimError.code, bsimError.message);
    }
    const message = (error as Error)?.message ?? 'get BSIM version failed';
    throw new ErrorGetBSIMVersion(ErrorGetBSIMVersion.code, message);
  }
}
