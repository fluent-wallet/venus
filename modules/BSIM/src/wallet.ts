import { Platform } from 'react-native';
import { createApduTransport, type ApduTransportOptions } from './transports/apdu';
import { createBleTransport, type BleTransportOptions } from './transports/ble';
import { TransportError, TransportErrorCode, isTransportError } from './transports/errors';
import type { Transport, TransportSession } from './transports/types';
import type { HexString, PubkeyRecord, SignatureComponents } from './core/types';
import { exportPubkeysFlow, getVersionFlow, signMessageFlow, verifyBpinFlow } from './core/workflows';

export type WalletLogger = (event: string, context?: Record<string, unknown>) => void;

type TransportKindConfig =
  | { kind: 'apdu'; transport?: Transport<ApduTransportOptions>; options?: ApduTransportOptions }
  | { kind: 'ble'; transport?: Transport<BleTransportOptions>; options?: BleTransportOptions };

export type WalletOptions = {
  platform?: typeof Platform.OS;
  transports?: TransportKindConfig[];
  logger?: WalletLogger;
};

type ResolvedTransport = TransportKindConfig & {
  transport: Transport<ApduTransportOptions | BleTransportOptions>;
};

type SessionContext = {
  kind: 'apdu' | 'ble';
};

export type WalletSessionRunner = <T>(operation: (session: TransportSession, context: SessionContext) => Promise<T>) => Promise<T>;

export type SignMessageParams = {
  hash: HexString;
  coinType: number;
  index: number;
};

export type Wallet = {
  runSession: WalletSessionRunner;
  verifyBpin(): Promise<void>;
  exportPubkeys(): Promise<PubkeyRecord[]>;
  signMessage(params: SignMessageParams): Promise<SignatureComponents>;
  getVersion(): Promise<string>;
};

const noopLogger: WalletLogger = () => undefined;

const buildDefaultTransports = (platform: typeof Platform.OS): TransportKindConfig[] => {
  if (platform === 'android') {
    return [{ kind: 'apdu' }, { kind: 'ble' }];
  }
  return [{ kind: 'ble' }];
};

const resolveTransports = (configs: TransportKindConfig[]): ResolvedTransport[] => {
  return configs.map((config) => {
    if (config.transport) {
      return { ...config, transport: config.transport };
    }
    if (config.kind === 'apdu') {
      return { ...config, transport: createApduTransport() };
    }
    return { ...config, transport: createBleTransport() };
  });
};

const runOperation = async <T>(
  label: string,
  runner: WalletSessionRunner,
  logger: WalletLogger,
  handler: (transmit: TransportSession['transmit'], context: SessionContext) => Promise<T>,
): Promise<T> => {
  return runner((session, context) => {
    logger('wallet.operation.start', { label, transport: context.kind });
    return handler(session.transmit, context)
      .then((result) => {
        logger('wallet.operation.success', { label, transport: context.kind });
        return result;
      })
      .catch((error) => {
        logger('wallet.operation.error', { label, transport: context.kind, error });
        throw error;
      });
  });
};

export const createWallet = (options: WalletOptions = {}): Wallet => {
  const platform = options.platform ?? Platform.OS;
  const logger = options.logger ?? noopLogger;

  const candidates = resolveTransports(options.transports ?? buildDefaultTransports(platform));

  if (!candidates.length) {
    throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'No transports available for BSIM wallet');
  }

  let busy = false;

  const runExclusive = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (busy) {
      throw new TransportError(TransportErrorCode.SESSION_BUSY, 'A wallet operation is already in progress');
    }
    busy = true;
    try {
      return await operation();
    } finally {
      busy = false;
    }
  };

  const runSession: WalletSessionRunner = async (operation) => {
    return runExclusive(async () => {
      let lastError: unknown;

      for (const candidate of candidates) {
        let session: TransportSession | undefined;

        try {
          session = await candidate.transport.open(candidate.options);
          logger('wallet.transport.opened', { kind: candidate.kind });
        } catch (error) {
          lastError = error;
          logger('wallet.transport.open_failed', { kind: candidate.kind, error });
          continue;
        }

        try {
          return await operation(session, { kind: candidate.kind });
        } finally {
          try {
            await session.close();
            logger('wallet.transport.closed', { kind: candidate.kind });
          } catch (closeError) {
            logger('wallet.transport.close_failed', { kind: candidate.kind, error: closeError });
          }
        }
      }

      if (lastError) {
        if (isTransportError(lastError)) {
          throw lastError;
        }
        throw new TransportError(TransportErrorCode.CHANNEL_OPEN_FAILED, 'Failed to open any BSIM transport', { cause: lastError });
      }

      throw new TransportError(TransportErrorCode.CHANNEL_OPEN_FAILED, 'No transport candidates were attempted');
    });
  };

  return {
    runSession,
    verifyBpin: () => runOperation('verifyBpin', runSession, logger, (transmit) => verifyBpinFlow(transmit)),
    exportPubkeys: () => runOperation('exportPubkeys', runSession, logger, (transmit) => exportPubkeysFlow(transmit)),
    signMessage: (params) =>
      runOperation('signMessage', runSession, logger, (transmit) => signMessageFlow(transmit, params.hash, params.coinType, params.index)),
    getVersion: () => runOperation('getVersion', runSession, logger, (transmit) => getVersionFlow(transmit)),
  };
};
