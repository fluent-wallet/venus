export { COIN_TYPE_CONFIG, DEFAULT_SIGNATURE_ALGORITHM, getCoinTypeIndex, getDefaultSignatureAlgorithm, SIGNATURE_ALGORITHMS } from './constants';
export {
  APDU_STATUS,
  type ApduStatusCode,
  CARD_ERROR_MESSAGES,
  type CardErrorCode,
  isCardErrorCode,
  isPendingStatus,
  isProactiveStatus,
  isSuccessStatus,
  resolveStatusMessage,
} from './core/errors';
export type { ApduCommand, ApduTransmit, PubkeyRecord, SignatureComponents } from './core/types';
export { BSIMError } from './errors';
export {
  type ApduTransportOptions,
  type BleTransportOptions,
  createApduTransport,
  createBleTransport,
  isTransportError,
  startBleDeviceScan,
  type Transport,
  TransportError,
  TransportErrorCode,
  type TransportSession,
} from './transports';
export { createAsyncQueue } from './transports/utils';
export { CoinTypes } from './types';

export {
  type BackupSeedParams,
  createWallet,
  type DeriveKeyParams,
  type RestoreSeedParams,
  type SignMessageParams,
  type Wallet,
  type WalletOptions,
  type WalletSessionRunner,
} from './wallet';
