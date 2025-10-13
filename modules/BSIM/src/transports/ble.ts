import { Buffer } from '@craftzdog/react-native-buffer';
import { Platform } from 'react-native';
import { BleError, BleManager, type Device, type Subscription } from 'react-native-ble-plx';
import type { HexString } from '../core/types';
import { fromHex, normalizeHex, toHex } from '../core/utils';
import { TransportError, TransportErrorCode, wrapNativeError } from './errors';
import type { Transport, TransportSession } from './types';

const MAX_CHUNK_BYTES = 19;
const OUTBOUND_FRAME_TYPE = 0x02;
const INBOUND_FRAME_TYPE = 0x12;

const DEFAULT_IDENTIFIERS = {
  serviceUuid: 'FF10',
  writeCharacteristicUuid: 'FF11',
  notifyCharacteristicUuid: 'FF12',
} as const;

const DEFAULT_SCAN_TIMEOUT_MS = 10_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_RESPONSE_TIMEOUT_MS = 5_000;

type TimerRef = ReturnType<typeof setTimeout>;

type BleCharacteristicIds = {
  serviceUuid: string;
  writeCharacteristicUuid: string;
  notifyCharacteristicUuid: string;
};

type BleEncryption = {
  encrypt(payload: Uint8Array): Uint8Array;
  decrypt(payload: Uint8Array): Uint8Array;
};

const passthroughEncryption: BleEncryption = {
  encrypt: (payload) => payload,
  decrypt: (payload) => payload,
};

type PendingResponse = {
  resolve: (value: Uint8Array) => void;
  reject: (error: unknown) => void;
  timeout?: TimerRef;
  buffer: Uint8Array;
  expectedFrames: number;
  lastSequence: number;
};

const noopLogger = () => {
  /* no-op */
};

const matchesUuid = (candidate: string, target: string) => {
  const normalizedCandidate = normalizeUuid(candidate);
  const normalizedTarget = normalizeUuid(target);

  if (normalizedCandidate === normalizedTarget) {
    return true;
  }

  const isCandidate128 = normalizedCandidate.length === 32;
  const isTarget128 = normalizedTarget.length === 32;
  const isCandidate16 = normalizedCandidate.length === 4;
  const isTarget16 = normalizedTarget.length === 4;

  if (isCandidate128 && isTarget16) {
    return normalizedCandidate.includes(normalizedTarget);
  }

  if (isTarget128 && isCandidate16) {
    return normalizedTarget.includes(normalizedCandidate);
  }

  return false;
};

const normalizeUuid = (uuid: string) => uuid.replace(/[^a-fA-F0-9]/g, '').toLowerCase();

const concatBytes = (head: Uint8Array, tail: Uint8Array) => {
  if (head.length === 0) {
    return tail.slice();
  }
  if (tail.length === 0) {
    return head.slice();
  }
  const buffer = new Uint8Array(head.length + tail.length);
  buffer.set(head, 0);
  buffer.set(tail, head.length);
  return buffer;
};

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

const fromBase64 = (value: string) => Uint8Array.from(Buffer.from(value, 'base64').values());

const wrapBleError = (
  code: TransportErrorCode,
  error: unknown,
  fallback: string,
  extraDetails?: { deviceId?: string; serviceUuid?: string; characteristicUuid?: string },
) => {
  const wrapped = wrapNativeError(code, error, fallback);
  return new TransportError(code, wrapped.message, {
    cause: (wrapped as TransportError).cause ?? error,
    details: {
      ...((wrapped as TransportError).details ?? {}),
      ...(extraDetails ?? {}),
    },
  });
};

const buildOutgoingFrames = (hex: string, encryption: BleEncryption) => {
  const payload = fromHex(hex);
  const encrypted = encryption.encrypt(payload);

  const body = new Uint8Array(3 + encrypted.length);
  body[0] = OUTBOUND_FRAME_TYPE;
  body[1] = (encrypted.length >> 8) & 0xff;
  body[2] = encrypted.length & 0xff;
  body.set(encrypted, 3);

  const totalFrames = Math.ceil(body.length / MAX_CHUNK_BYTES);
  if (totalFrames <= 0 || totalFrames > 0x0f) {
    throw new TransportError(TransportErrorCode.INVALID_APDU_PAYLOAD, `BLE frame count ${totalFrames} is out of range (1-15)`);
  }

  const frames: Uint8Array[] = [];
  for (let sequence = 0; sequence < totalFrames; sequence += 1) {
    const chunkStart = sequence * MAX_CHUNK_BYTES;
    const chunkEnd = Math.min(chunkStart + MAX_CHUNK_BYTES, body.length);
    const frame = new Uint8Array(1 + (chunkEnd - chunkStart));
    frame[0] = (totalFrames << 4) | (sequence & 0x0f);
    frame.set(body.subarray(chunkStart, chunkEnd), 1);
    frames.push(frame);
  }
  return frames;
};

const decodeIncomingPayload = (payload: Uint8Array, encryption: BleEncryption) => {
  if (payload.length < 3) {
    throw new TransportError(TransportErrorCode.TRANSMIT_FAILED, 'BLE response payload is too short');
  }
  if (payload[0] !== INBOUND_FRAME_TYPE) {
    throw new TransportError(TransportErrorCode.TRANSMIT_FAILED, `Unexpected BLE response type 0x${payload[0].toString(16)}`);
  }

  const length = (payload[1] << 8) | payload[2];
  const ciphertext = payload.subarray(3, 3 + length);
  if (ciphertext.length !== length) {
    throw new TransportError(TransportErrorCode.TRANSMIT_FAILED, 'BLE response length mismatch');
  }

  const decrypted = encryption.decrypt(ciphertext);
  return toHex(decrypted);
};

const withTimeout = async <T>(
  timers: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout },
  timeoutMs: number,
  factory: () => Promise<T>,
  onTimeout: () => TransportError,
) => {
  if (timeoutMs <= 0) {
    return factory();
  }
  return new Promise<T>((resolve, reject) => {
    const timer = timers.setTimeout(() => {
      reject(onTimeout());
    }, timeoutMs);

    factory()
      .then((result) => {
        timers.clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        timers.clearTimeout(timer);
        reject(error);
      });
  });
};

const scanForDevice = async (
  manager: BleManager,
  timeoutMs: number,
  identifiers: BleCharacteristicIds,
  timers: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout },
  filter: BleTransportOptions['filter'],
  logger: (event: string, context?: Record<string, unknown>) => void,
) => {
  return new Promise<Device>((resolve, reject) => {
    let stopped = false;

    const stop = () => {
      if (!stopped) {
        manager.stopDeviceScan();
        stopped = true;
      }
    };

    const timer = timers.setTimeout(() => {
      stop();
      reject(new TransportError(TransportErrorCode.SCAN_FAILED, 'BLE scan timed out'));
    }, timeoutMs);

    const serviceUuids = (filter?.serviceUuids?.length ?? 0) ? filter?.serviceUuids : identifiers.serviceUuid ? [identifiers.serviceUuid] : undefined;

    manager.startDeviceScan(serviceUuids ?? null, null, (error, device) => {
      if (error) {
        stop();
        timers.clearTimeout(timer);
        reject(wrapBleError(TransportErrorCode.SCAN_FAILED, error, 'BLE scan failed'));
        return;
      }

      if (!device) {
        return;
      }

      if (filter?.localNamePrefix && !device.name?.startsWith(filter.localNamePrefix)) {
        return;
      }

      logger('ble.scan.match', { deviceId: device.id, name: device.name });
      stop();
      timers.clearTimeout(timer);
      resolve(device);
    });
  });
};

const ensureCharacteristics = async (manager: BleManager, deviceId: string, identifiers: BleCharacteristicIds) => {
  const services = await manager.servicesForDevice(deviceId);
  const targetService = services.find((service) => matchesUuid(service.uuid, identifiers.serviceUuid));
  if (!targetService) {
    throw new TransportError(TransportErrorCode.SERVICE_NOT_FOUND, `BLE service ${identifiers.serviceUuid} not found`, {
      cause: undefined,
      details: { deviceId, serviceUuid: identifiers.serviceUuid },
    });
  }

  const characteristics = await manager.characteristicsForDevice(deviceId, targetService.uuid);
  const writeCharacteristic = characteristics.find((characteristic) => matchesUuid(characteristic.uuid, identifiers.writeCharacteristicUuid));
  if (!writeCharacteristic) {
    throw new TransportError(TransportErrorCode.CHARACTERISTIC_NOT_FOUND, `BLE write characteristic ${identifiers.writeCharacteristicUuid} not found`, {
      cause: undefined,
      details: { deviceId, serviceUuid: targetService.uuid, characteristicUuid: identifiers.writeCharacteristicUuid },
    });
  }

  const notifyCharacteristic = characteristics.find((characteristic) => matchesUuid(characteristic.uuid, identifiers.notifyCharacteristicUuid));
  if (!notifyCharacteristic) {
    throw new TransportError(TransportErrorCode.CHARACTERISTIC_NOT_FOUND, `BLE notify characteristic ${identifiers.notifyCharacteristicUuid} not found`, {
      cause: undefined,
      details: { deviceId, serviceUuid: targetService.uuid, characteristicUuid: identifiers.notifyCharacteristicUuid },
    });
  }

  return {
    serviceUuid: targetService.uuid,
    writeUuid: writeCharacteristic.uuid,
    notifyUuid: notifyCharacteristic.uuid,
  };
};

export type BleTransportOptions = {
  deviceId?: string;
  scanTimeoutMs?: number;
  connectTimeoutMs?: number;
  responseTimeoutMs?: number;
  filter?: {
    serviceUuids?: string[];
    localNamePrefix?: string;
  };
  encryptionKey?: HexString;
};

type CreateBleTransportDeps = {
  manager?: BleManager;
  createManager?: () => BleManager;
  identifiers?: Partial<BleCharacteristicIds>;
  encryptionFactory?: (key: Uint8Array) => BleEncryption;
  timers?: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
  logger?: (event: string, context?: Record<string, unknown>) => void;
};

export const createBleTransport = (deps: CreateBleTransportDeps = {}): Transport<BleTransportOptions> => {
  let manager = deps.manager;
  let shouldDestroyManager = false;

  const timers = {
    setTimeout: deps.timers?.setTimeout ?? setTimeout,
    clearTimeout: deps.timers?.clearTimeout ?? clearTimeout,
  };

  const identifiers: BleCharacteristicIds = {
    serviceUuid: deps.identifiers?.serviceUuid ?? DEFAULT_IDENTIFIERS.serviceUuid,
    writeCharacteristicUuid: deps.identifiers?.writeCharacteristicUuid ?? DEFAULT_IDENTIFIERS.writeCharacteristicUuid,
    notifyCharacteristicUuid: deps.identifiers?.notifyCharacteristicUuid ?? DEFAULT_IDENTIFIERS.notifyCharacteristicUuid,
  };

  const logger = deps.logger ?? noopLogger;

  let isOpen = false;
  let connectedDeviceId: string | undefined;
  let serviceUuid: string | undefined;
  let writeUuid: string | undefined;
  let notifyUuid: string | undefined;
  let monitorSubscription: Subscription | undefined;
  let disconnectSubscription: Subscription | undefined;
  let pendingResponse: PendingResponse | undefined;
  let encryption: BleEncryption = passthroughEncryption;

  let chain: Promise<void> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>) => {
    const job = chain.then(operation, operation);
    chain = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  };

  const ensureManager = () => {
    if (!manager) {
      manager = deps.createManager ? deps.createManager() : new BleManager();
      shouldDestroyManager = !deps.manager;
    }
    return manager;
  };

  const cleanupPending = (error?: unknown) => {
    if (!pendingResponse) {
      return;
    }
    const current = pendingResponse;
    pendingResponse = undefined;
    if (current.timeout) {
      timers.clearTimeout(current.timeout);
    }
    if (error) {
      current.reject(error);
    }
  };

  const teardown = async () => {
    cleanupPending(new TransportError(TransportErrorCode.CHANNEL_NOT_OPEN, 'BLE channel closed'));

    monitorSubscription?.remove();
    monitorSubscription = undefined;

    disconnectSubscription?.remove();
    disconnectSubscription = undefined;

    if (connectedDeviceId && manager) {
      try {
        await manager.cancelDeviceConnection(connectedDeviceId);
      } catch (error) {
        logger('ble.close.cancel_failed', { deviceId: connectedDeviceId, error });
      }
    }

    connectedDeviceId = undefined;
    serviceUuid = undefined;
    writeUuid = undefined;
    notifyUuid = undefined;

    if (shouldDestroyManager && manager) {
      manager.destroy();
      manager = undefined;
      shouldDestroyManager = false;
    }
  };

  const handleIncomingFrame = (frame: Uint8Array) => {
    if (!pendingResponse) {
      return;
    }

    if (frame.length === 0) {
      pendingResponse.reject(new TransportError(TransportErrorCode.TRANSMIT_FAILED, 'Received empty BLE frame'));
      return;
    }

    const controller = pendingResponse;
    const totalFrames = frame[0] >> 4;
    const sequence = frame[0] & 0x0f;

    if (totalFrames === 0) {
      controller.reject(new TransportError(TransportErrorCode.TRANSMIT_FAILED, 'BLE frame reports zero segments'));
      return;
    }

    if (sequence === 0) {
      controller.buffer = frame.slice(1);
      controller.expectedFrames = totalFrames;
      controller.lastSequence = 0;
    } else {
      if (controller.expectedFrames === 0) {
        controller.reject(new TransportError(TransportErrorCode.TRANSMIT_FAILED, 'Unexpected BLE frame before start'));
        return;
      }
      if (sequence !== controller.lastSequence + 1) {
        controller.reject(new TransportError(TransportErrorCode.TRANSMIT_FAILED, 'BLE frame sequence mismatch'));
        return;
      }
      controller.buffer = concatBytes(controller.buffer, frame.slice(1));
      controller.lastSequence = sequence;
    }

    if (sequence + 1 === controller.expectedFrames) {
      controller.resolve(controller.buffer);
    }
  };

  return {
    kind: 'ble',
    async open(options?: BleTransportOptions): Promise<TransportSession> {
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'BLE transport requires iOS or Android');
      }
      if (isOpen) {
        throw new TransportError(TransportErrorCode.CHANNEL_ALREADY_OPEN, 'BLE channel already open');
      }

      const managerInstance = ensureManager();
      const scanTimeoutMs = options?.scanTimeoutMs ?? DEFAULT_SCAN_TIMEOUT_MS;
      const connectTimeoutMs = options?.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
      const responseTimeoutMs = options?.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS;

      const encryptionKey = options?.encryptionKey ? fromHex(options.encryptionKey) : undefined;
      if (encryptionKey && !deps.encryptionFactory) {
        throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'BLE encryption key provided but no encryptionFactory was configured');
      }
      encryption = encryptionKey ? deps.encryptionFactory!(encryptionKey) : passthroughEncryption;

      let device: Device;
      if (options?.deviceId) {
        device = await withTimeout(
          timers,
          connectTimeoutMs,
          () => managerInstance.connectToDevice(options.deviceId!, { autoConnect: false }),
          () => new TransportError(TransportErrorCode.CHANNEL_OPEN_FAILED, 'BLE connection timeout'),
        );
      } else {
        device = await scanForDevice(managerInstance, scanTimeoutMs, identifiers, timers, options?.filter, logger);
        device = await withTimeout(
          timers,
          connectTimeoutMs,
          () => managerInstance.connectToDevice(device.id, { autoConnect: false }),
          () => new TransportError(TransportErrorCode.CHANNEL_OPEN_FAILED, 'BLE connection timeout'),
        );
      }

      connectedDeviceId = device.id;

      disconnectSubscription = managerInstance.onDeviceDisconnected(device.id, (error) => {
        logger('ble.disconnected', { deviceId: device.id, error });
        cleanupPending(
          error
            ? wrapBleError(TransportErrorCode.CHANNEL_NOT_OPEN, error, 'BLE device disconnected', {
                deviceId: device.id,
              })
            : new TransportError(TransportErrorCode.CHANNEL_NOT_OPEN, 'BLE device disconnected'),
        );
        isOpen = false;
      });

      await managerInstance.discoverAllServicesAndCharacteristicsForDevice(device.id);

      const resolved = await ensureCharacteristics(managerInstance, device.id, identifiers);
      serviceUuid = resolved.serviceUuid;
      writeUuid = resolved.writeUuid;
      notifyUuid = resolved.notifyUuid;

      monitorSubscription = managerInstance.monitorCharacteristicForDevice(device.id, serviceUuid, notifyUuid, (error, characteristic) => {
        if (error) {
          cleanupPending(
            wrapBleError(TransportErrorCode.ENABLE_NOTIFICATIONS_FAILED, error, 'BLE notification error', {
              deviceId: device.id,
              serviceUuid,
              characteristicUuid: notifyUuid,
            }),
          );
          return;
        }
        if (!characteristic?.value) {
          return;
        }
        try {
          handleIncomingFrame(fromBase64(characteristic.value));
        } catch (err) {
          cleanupPending(err);
        }
      });

      isOpen = true;

      const transmit = (payload: string) => {
        const normalized = normalizeHex(payload);
        return enqueue(async () => {
          if (!isOpen || !connectedDeviceId || !serviceUuid || !writeUuid) {
            throw new TransportError(TransportErrorCode.CHANNEL_NOT_OPEN, 'BLE channel is not open');
          }

          if (pendingResponse) {
            throw new TransportError(TransportErrorCode.SESSION_BUSY, 'Another BLE operation is still pending');
          }

          const frames = buildOutgoingFrames(normalized, encryption);

          let resolvePending: (value: Uint8Array) => void;
          let rejectPending: (error: unknown) => void;

          const responsePromise = new Promise<Uint8Array>((resolve, reject) => {
            resolvePending = resolve;
            rejectPending = reject;
          });

          pendingResponse = {
            resolve: (value) => {
              if (pendingResponse?.timeout) {
                timers.clearTimeout(pendingResponse.timeout);
              }
              pendingResponse = undefined;
              resolvePending(value);
            },
            reject: (error) => {
              if (pendingResponse?.timeout) {
                timers.clearTimeout(pendingResponse.timeout);
              }
              pendingResponse = undefined;
              rejectPending(error);
            },
            buffer: new Uint8Array(0),
            expectedFrames: 0,
            lastSequence: -1,
          };

          pendingResponse.timeout = timers.setTimeout(() => {
            cleanupPending(new TransportError(TransportErrorCode.READ_TIMEOUT, 'BLE response timeout'));
          }, responseTimeoutMs);

          try {
            for (const frame of frames) {
              const base64 = toBase64(frame);
              await managerInstance.writeCharacteristicWithResponseForDevice(connectedDeviceId!, serviceUuid!, writeUuid!, base64);
            }
          } catch (error) {
            cleanupPending(
              wrapBleError(TransportErrorCode.WRITE_FAILED, error, 'Failed to write BLE frame', {
                deviceId: connectedDeviceId,
                serviceUuid,
                characteristicUuid: writeUuid,
              }),
            );
          }

          const rawResponse = await responsePromise;
          return decodeIncomingPayload(rawResponse, encryption);
        });
      };

      const close = async () => {
        if (!isOpen) {
          return;
        }
        isOpen = false;

        await chain.catch(() => undefined);
        await teardown();
      };

      return {
        transmit,
        close,
      };
    },
  };
};
