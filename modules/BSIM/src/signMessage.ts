import {
  BSIMError,
  ErrorSignCoinTypeNotFind,
  ErrorSignGetPublicKey,
  ErrorSignMessage,
} from './errors';
import {BSIM} from './sdk';
import {CoinTypes} from './types';
import {verifyBPIN} from './verifyBPIN';

export type SignMessageErrorType =
  | ErrorSignMessage
  | ErrorSignCoinTypeNotFind
  | ErrorSignGetPublicKey
  | BSIMError;
export type SignMessageReturnType = {
  code: string;
  message: string;
  r: string;
  s: string;
  v: string;
};

export type SignMessageParametersType = {
  messageHash: string;
  /**
   * coin type number eg: 60  503
   */
  coinType: number;
  /**
   * public key index
   */
  coinTypeIndex: number;
};
/**
 * sign message hash use BSIM
 * call this function after {@link verifyBPIN} function
 * might need to be called multiple times after call {@link verifyBPIN}
 * @throws {SignMessageErrorType}
 * @param messageHash need sign message hash
 * @param coinTypeIndex
 * @returns {Promise<string>} - sign result
 */
export async function signMessage({
  messageHash,
  coinType,
  coinTypeIndex,
}: SignMessageParametersType): Promise<SignMessageReturnType> {
  try {
    const result = await BSIM.signMessage(messageHash, coinType, coinTypeIndex);
    return result;
  } catch (e) {
    const error = e as BSIMError;

    switch (error.code) {
      case ErrorSignCoinTypeNotFind.code:
        throw new ErrorSignCoinTypeNotFind(error.code, error.message);
      case ErrorSignMessage.code:
        throw new ErrorSignMessage(error.code, error.message);
      case ErrorSignGetPublicKey.code:
        throw new ErrorSignGetPublicKey(error.code, error.message);

      default:
        throw new BSIMError(error.code, error.message);
    }
  }
}
