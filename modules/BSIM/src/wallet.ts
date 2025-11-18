import { Platform } from 'react-native';
import { createApduTransport, type ApduTransportOptions } from './transports/apdu';
import { createBleTransport, type BleTransportOptions } from './transports/ble';
import { TransportError, TransportErrorCode, isTransportError } from './transports/errors';
import type { Transport, TransportSession } from './transports/types';
import type { HexString, PubkeyRecord, SignatureComponents } from './core/types';
import { deriveKeyFlow, exportPubkeysFlow, getIccidFlow, getVersionFlow, signMessageFlow, updateBpinFlow, verifyBpinFlow } from './core/workflows';
import { DEFAULT_SIGNATURE_ALGORITHM } from './constants';

const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

export type WalletLogger = (event: string, context?: Record<string, unknown>) => void;

type TransportKindConfig =
  | { kind: 'apdu'; transport?: Transport<ApduTransportOptions>; options?: ApduTransportOptions }
  | { kind: 'ble'; transport?: Transport<BleTransportOptions>; options?: BleTransportOptions };

export type WalletOptions = {
  platform?: typeof Platform.OS;
  transports?: TransportKindConfig[];
  logger?: WalletLogger;
  idleTimeoutMs?: number;
};

type ResolvedTransport = TransportKindConfig & {
  transport: Transport<ApduTransportOptions | BleTransportOptions>;
  session?: TransportSession;
  idleTimer?: ReturnType<typeof setTimeout>;
};

const clearIdleTimer = (candidate: ResolvedTransport) => {
  if (candidate.idleTimer) {
    clearTimeout(candidate.idleTimer);
    candidate.idleTimer = undefined;
  }
};

const closeCandidateSession = async (candidate: ResolvedTransport, logger: WalletLogger) => {
  const { session, kind } = candidate;
  if (!session) {
    return;
  }

  candidate.session = undefined;
  clearIdleTimer(candidate);

  await session.close();
  logger('wallet.transport.closed', { kind });
};

const scheduleIdleClose = (candidate: ResolvedTransport, logger: WalletLogger, timeout: number) => {
  clearIdleTimer(candidate);

  if (timeout <= 0) {
    return;
  }

  candidate.idleTimer = setTimeout(() => {
    closeCandidateSession(candidate, logger).catch((error) => {
      logger('wallet.transport.close_failed', { kind: candidate.kind, error });
    });
  }, timeout);
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

export type DeriveKeyParams = {
  coinType: number;
  algorithm?: number;
};

export type Wallet = {
  runSession: WalletSessionRunner;
  verifyBpin(): Promise<void>;
  exportPubkeys(): Promise<PubkeyRecord[]>;
  signMessage(params: SignMessageParams): Promise<SignatureComponents>;
  deriveKey(params: DeriveKeyParams): Promise<void>;
  updateBpin(): Promise<'ok'>;
  getVersion(): Promise<string>;
  getIccid(): Promise<string>;
};
const noopLogger: WalletLogger = () => undefined;

const BLE_DEFAULTS: BleTransportOptions = {
  scanTimeoutMs: 20_000,
  connectTimeoutMs: 15_000,
  responseTimeoutMs: 8_000,
};

const buildDefaultTransports = (platform: typeof Platform.OS): TransportKindConfig[] => {
  if (platform === 'android') {
    return [{ kind: 'apdu' }];
  }
  return [{ kind: 'ble', options: BLE_DEFAULTS }];
};

const resolveTransports = (configs: TransportKindConfig[], logger: WalletLogger): ResolvedTransport[] => {
  return configs.map((config) => {
    let resolved: ResolvedTransport;
    if (config.transport) {
      resolved = { ...config, transport: config.transport } as ResolvedTransport;
    } else if (config.kind === 'apdu') {
      resolved = { ...config, transport: createApduTransport() } as ResolvedTransport;
    } else {
      resolved = { ...config, transport: createBleTransport({ logger }) } as ResolvedTransport;
    }
    return resolved;
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
  const idleTimeout = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;

  const candidates = resolveTransports(options.transports ?? buildDefaultTransports(platform), logger);

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
        let session = candidate.session;

        if (!session) {
          try {
            session = await candidate.transport.open(candidate.options);
            candidate.session = session;
            logger('wallet.transport.opened', { kind: candidate.kind });
          } catch (error) {
            lastError = error;
            logger('wallet.transport.open_failed', { kind: candidate.kind, error });
            continue;
          }
        }

        clearIdleTimer(candidate);

        try {
          const result = await operation(session, { kind: candidate.kind });
          scheduleIdleClose(candidate, logger, idleTimeout);
          return result;
        } catch (error) {
          lastError = error;

          if (isTransportError(error)) {
            if (error.code === TransportErrorCode.TRANSMIT_FAILED) {
              scheduleIdleClose(candidate, logger, idleTimeout);
            } else {
              try {
                await closeCandidateSession(candidate, logger);
              } catch (closeError) {
                logger('wallet.transport.close_failed', { kind: candidate.kind, error: closeError });
              }
            }
          } else {
            scheduleIdleClose(candidate, logger, idleTimeout);
          }
          logger('wallet.operation.failed', { label: operation.name ?? 'anonymous', transport: candidate.kind, error });
          throw error;
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
    deriveKey: (params) =>
      runOperation('deriveKey', runSession, logger, (transmit) => deriveKeyFlow(transmit, params.coinType, params.algorithm ?? DEFAULT_SIGNATURE_ALGORITHM)),
    updateBpin: () => runOperation('updateBpin', runSession, logger, (transmit) => updateBpinFlow(transmit)),
    getVersion: () => runOperation('getVersion', runSession, logger, async (transmit) => getVersionFlow(transmit)),
    getIccid: () => runOperation('getIccid', runSession, logger, async (transmit) => getIccidFlow(transmit)),
  };
};
