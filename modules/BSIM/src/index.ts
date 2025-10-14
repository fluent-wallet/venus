export { CoinTypes } from './types';
export { BSIMError } from './errors';

export { genNewKey, type GenNewKeyErrorType } from './genNewKey';

export { getVersion } from './getVersion';

export { getBSIMVersion, type GetBSIMVersionErrorType } from './getBSIMVersion';

export {
  getPublicKeyAndAddress,
  type GetPublicKeyAndAddressReturnType,
  type PublicKeyAndAddress503Type,
  type PublicKeyAndAddress60Type,
} from './getPublicKeyAndAddress';

export { verifyBPIN, type VerifyBPINErrorType } from './verifyBPIN';

export { updateBPIN, type UpdateBPINErrorType } from './updateBPIN';

export { signMessage, type SignMessageReturnType, type SignMessageErrorType } from './signMessage';

export {
  createWallet,
  type Wallet,
  type WalletOptions,
  type WalletSessionRunner,
  type SignMessageParams,
} from './wallet';
