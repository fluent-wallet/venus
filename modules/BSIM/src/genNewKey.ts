import {CoinTypes} from './types';
import {
  BSIMError,
  ErrorCoinTypesNotSupported,
  ErrorGenerateNewKey,
} from './errors';
import {BSIM} from './sdk';

export type GenNewKeyErrorType =
  | ErrorCoinTypesNotSupported
  | ErrorGenerateNewKey
  | BSIMError;

/**
 * generate new key
 * @param coin - {@link CoinTypes}
 * @throws {GenNewKeyErrorType} - error
 * @example
 * ```ts
 * await genNewKey(CoinTypes.ETHEREUM)
 *
 * ```
 */
export async function genNewKey(
  coin: CoinTypes = CoinTypes.ETHEREUM,
): Promise<void> {
  try {
    await BSIM.genNewKey(coin);
  } catch (e: unknown) {
    const error = e as BSIMError;
    switch (error.code) {
      case ErrorCoinTypesNotSupported.code:
        throw new ErrorCoinTypesNotSupported(error.code, error.message);
      case ErrorGenerateNewKey.code:
        throw new ErrorGenerateNewKey(error.code, error.message);
      default:
        throw new BSIMError(error.code, error.message);
    }
  }
}
