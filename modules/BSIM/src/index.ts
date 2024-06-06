export {CoinTypes} from './types';

export {genNewKey, type GenNewKeyErrorType} from './genNewKey';

export {getVersion} from './getVersion';

export {getBSIMVersion, type GetBSIMVersionErrorType} from './getBSIMVersion';

export {getPublicKeyAndAddress} from './getPublicKeyAndAddress';

export {verifyBPIN, type VerifyBPINErrorType} from './verifyBPIN';

export {updateBPIN, type UpdateBPINErrorType} from './updateBPIN';

export {
  signMessage,
  type SignMessageReturnType,
  type SignMessageErrorType,
} from './signMessage';
