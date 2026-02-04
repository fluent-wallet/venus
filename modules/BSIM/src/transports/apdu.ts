import { NativeModules, Platform } from 'react-native';
import { BSIM_AID } from '../core/params';
import type { HexString } from '../core/types';
import { normalizeHex } from '../core/utils';
import { TransportError, TransportErrorCode, wrapNativeError } from './errors';
import type { Transport, TransportSession } from './types';
import { createAsyncQueue } from './utils';

type NativeApduModule = {
  openApduChannel: (aid: string) => Promise<void>;
  closeApduChannel: () => Promise<void>;
  transmitApdu: (payload: string) => Promise<string>;
};

export type ApduTransportOptions = {
  aid?: HexString;
};

type CreateApduTransportDeps = {
  nativeModule?: NativeApduModule;
  platform?: typeof Platform.OS;
};

const ensureNativeModule = (native?: NativeApduModule): NativeApduModule => {
  const bridge = native ?? (NativeModules.BSIM as Partial<NativeApduModule> | undefined);

  if (!bridge) {
    throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'BSIM native module is required for APDU transport');
  }

  const { openApduChannel, closeApduChannel, transmitApdu } = bridge;

  if (typeof openApduChannel !== 'function' || typeof closeApduChannel !== 'function' || typeof transmitApdu !== 'function') {
    throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'APDU transport methods are not implemented on this platform');
  }

  return { openApduChannel, closeApduChannel, transmitApdu };
};

const ensureHex = (value: string, code: TransportErrorCode): string => {
  try {
    return normalizeHex(value);
  } catch (error) {
    throw new TransportError(code, (error as Error).message, { cause: error });
  }
};

export const createApduTransport = (deps: CreateApduTransportDeps = {}): Transport<ApduTransportOptions> => {
  const platform = deps.platform ?? Platform.OS;

  let native: NativeApduModule | undefined;
  let isOpen = false;
  const queue = createAsyncQueue();

  const getNative = (): NativeApduModule => {
    if (!native || !isOpen) {
      throw new TransportError(TransportErrorCode.CHANNEL_NOT_OPEN, 'APDU channel is not open');
    }
    return native;
  };

  const transmitInternal = (payload: string) => {
    const module = getNative();
    const normalizedPayload = ensureHex(payload, TransportErrorCode.INVALID_APDU_PAYLOAD);

    return queue.enqueue(async () => {
      try {
        const response = await module.transmitApdu(normalizedPayload);
        return ensureHex(response, TransportErrorCode.TRANSMIT_FAILED);
      } catch (error) {
        throw wrapNativeError(TransportErrorCode.TRANSMIT_FAILED, error, 'Failed to transmit APDU');
      }
    });
  };

  const closeInternal = async (): Promise<void> => {
    if (!isOpen) {
      return;
    }

    await queue.flush();
    const module = native;

    try {
      await module?.closeApduChannel();
    } finally {
      isOpen = false;
      native = undefined;
      queue.reset();
    }
  };

  return {
    kind: 'apdu',
    async open(options?: ApduTransportOptions): Promise<TransportSession> {
      if (platform !== 'android') {
        throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'APDU transport is only available on Android');
      }

      native = ensureNativeModule(deps.nativeModule);
      const { aid = BSIM_AID } = options ?? {};

      const normalizedAid = ensureHex(aid, TransportErrorCode.INVALID_APDU_PAYLOAD);
      try {
        await native.openApduChannel(normalizedAid);
      } catch (error) {
        native = undefined;
        throw wrapNativeError(TransportErrorCode.CHANNEL_OPEN_FAILED, error, 'Failed to open APDU channel');
      }

      isOpen = true;

      const close = async () => {
        try {
          await closeInternal();
        } catch (error) {
          throw wrapNativeError(TransportErrorCode.CHANNEL_CLOSE_FAILED, error, 'Failed to close APDU channel');
        }
      };

      return {
        transmit: transmitInternal,
        close,
      };
    },
  };
};
