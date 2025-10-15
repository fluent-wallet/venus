export { CoinTypes } from './types';
export { BSIMError } from './errors';

export {
  createWallet,
  type Wallet,
  type WalletOptions,
  type WalletSessionRunner,
  type SignMessageParams,
  type DeriveKeyParams,
} from './wallet';

export {
  createApduTransport,
  type ApduTransportOptions,
  createBleTransport,
  type BleTransportOptions,
  TransportError,
  TransportErrorCode,
  isTransportError,
  type Transport,
  type TransportSession,
} from './transports';

export {
  SIGNATURE_ALGORITHMS,
  DEFAULT_SIGNATURE_ALGORITHM,
  getCoinTypeIndex,
  getDefaultSignatureAlgorithm,
} from './constants';
