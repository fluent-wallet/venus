import { Buffer } from '@craftzdog/react-native-buffer';
import { Platform } from 'react-native';
import { BleATTErrorCode, BleErrorCode, BleManager, type Device, State, type Subscription } from 'react-native-ble-plx';
import { APDU_STATUS } from '../core/errors';
import { BSIM_AID, buildSelectAid, serializeCommand } from '../core/params';
import { parseApduResponse } from '../core/response';
import type { HexString } from '../core/types';
import { fromHex, normalizeHex, toHex } from '../core/utils';
import { isTransportError, TransportError, TransportErrorCode, wrapNativeError } from './errors';
import type { Transport, TransportSession } from './types';
import { createAsyncQueue } from './utils';

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
const PAIRING_RETRY_DELAY_MS = 1_000;
const MAX_PAIRING_RETRIES = 30;
const buildSelectCommand = (aid: HexString) => serializeCommand(buildSelectAid(aid));

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
  timeoutId?: TimerRef;
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

const fromBase64 = (value: string) => {
  if (typeof globalThis.atob === 'function') {
    try {
      const ascii = globalThis.atob(value);
      const bytes = new Uint8Array(ascii.length);
      for (let index = 0; index < ascii.length; index += 1) {
        bytes[index] = ascii.charCodeAt(index);
      }
      return bytes;
    } catch {
      // fallback to Buffer implementation
    }
  }

  return Uint8Array.from(Buffer.from(value, 'base64').values());
};

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

  const declaredLength = (payload[1] << 8) | payload[2];
  const body = payload.subarray(3, 3 + declaredLength);
  if (body.length !== declaredLength) {
    throw new TransportError(TransportErrorCode.TRANSMIT_FAILED, 'BLE response length mismatch');
  }

  if (declaredLength === 2 && body[0] === 0x67 && body[1] === 0x00) {
    // Swift demo (BleDemoAppWithBond/BleDemoAPP/BsimMiddleware.swift) returns the raw status
    // when FF12 sends only two bytes (e.g. 0x67 0x00 during pairing), so we mirror that behaviour.
    return toHex(body);
  }

  const decrypted = encryption.decrypt(body);
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

export type BleDeviceScanResult = {
  deviceId: string;
  name: string;
};

export type BleDeviceScanOptions = {
  namePrefix?: string; // default: 'CT'
  serviceUuids?: string[]; // default: empty (no service filter)
};

export type BleDeviceScanHandle = {
  stop(): void;
};

const matchesNamePrefixIgnoreCase = (deviceName: string | null | undefined, prefix: string) => {
  if (!deviceName) return false;
  if (!prefix) return true;
  return deviceName.toUpperCase().startsWith(prefix.toUpperCase());
};

export const startBleDeviceScan = (
  options: BleDeviceScanOptions | undefined,
  onDevice: (device: BleDeviceScanResult) => void,
  onError?: (error: TransportError) => void,
): BleDeviceScanHandle => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'BLE scan requires iOS or Android');
  }

  const namePrefix = options?.namePrefix ?? 'CT';
  const serviceUuidsFilter = options?.serviceUuids?.length ? options.serviceUuids : null;

  const bleManager = new BleManager();
  const timers = { setTimeout, clearTimeout };

  const lastSeenNameByDeviceId = new Map<string, string>();
  let isStopped = false;
  let didReportError = false;

  const stop = () => {
    if (isStopped) return;
    isStopped = true;
    lastSeenNameByDeviceId.clear();
    try {
      bleManager.stopDeviceScan();
    } catch {
      // ignore
    }

    bleManager.destroy();
  };

  const reportErrorAndStop = (error: TransportError) => {
    if (didReportError) return;
    didReportError = true;
    onError?.(error);
    stop();
  };

  const start = async () => {
    try {
      await waitForAdapterReady(bleManager, DEFAULT_SCAN_TIMEOUT_MS, timers, noopLogger);
      if (isStopped) return;

      bleManager.startDeviceScan(serviceUuidsFilter, null, (error, device) => {
        if (isStopped) return;

        if (error) {
          reportErrorAndStop(wrapBleError(TransportErrorCode.SCAN_FAILED, error, 'BLE scan failed'));
          return;
        }

        if (!device?.id) return;
        if (!matchesNamePrefixIgnoreCase(device.name, namePrefix)) return;
        if (!device.name) return;

        const previousName = lastSeenNameByDeviceId.get(device.id);
        if (previousName === device.name) return;

        lastSeenNameByDeviceId.set(device.id, device.name);
        onDevice({ deviceId: device.id, name: device.name });
      });
    } catch (error) {
      const wrapped = wrapNativeError(TransportErrorCode.SCAN_FAILED, error, 'Failed to start BLE scan');
      reportErrorAndStop(wrapped);
    }
  };

  start();

  return { stop };
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

const waitForAdapterReady = async (
  manager: BleManager,
  timeoutMs: number,
  timers: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout },
  logger: (event: string, context?: Record<string, unknown>) => void,
) => {
  const mapStateToError = (state: State) => {
    if (state === State.PoweredOff) {
      return new TransportError(TransportErrorCode.SCAN_FAILED, 'Please enable Bluetooth before trying again.');
    }
    if (state === State.Unauthorized) {
      return new TransportError(TransportErrorCode.SCAN_FAILED, 'Bluetooth permission is required to continue.');
    }
    if (state === State.Unsupported) {
      return new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'Bluetooth LE is not supported on this device.');
    }
    return null;
  };

  const initialState = await manager.state();
  logger('ble.state.current', { state: initialState });

  const initialError = mapStateToError(initialState);
  if (initialError) throw initialError;
  if (initialState === State.PoweredOn) return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let subscription: Subscription | undefined;

    const finish = (settler: () => void) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) timers.clearTimeout(timeoutHandle);
      subscription?.remove();
      settler();
    };

    if (timeoutMs > 0) {
      timeoutHandle = timers.setTimeout(() => {
        finish(() => reject(new TransportError(TransportErrorCode.SCAN_FAILED, 'Timed out while waiting for Bluetooth to power on.')));
      }, timeoutMs);
    }

    subscription = manager.onStateChange((nextState) => {
      logger('ble.state.change', { state: nextState });
      const mappedError = mapStateToError(nextState);
      if (mappedError) {
        finish(() => reject(mappedError));
        return;
      }
      if (nextState === State.PoweredOn) {
        finish(resolve);
      }
    }, true);
  });
};
const shouldRetryPairing = (error: unknown) => {
  const candidate = error as { errorCode?: unknown; attErrorCode?: unknown; reason?: unknown; message?: unknown };
  if (candidate?.errorCode !== BleErrorCode.CharacteristicWriteFailed) {
    return false;
  }

  const attError = candidate.attErrorCode;
  if (
    attError === BleATTErrorCode.InsufficientAuthentication ||
    attError === BleATTErrorCode.InsufficientEncryption ||
    attError === BleATTErrorCode.InsufficientEncryptionKeySize
  ) {
    return true;
  }

  const lower = (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : '');
  const reason = lower(candidate.reason);
  const message = lower(candidate.message);
  const hasPairingHint =
    reason.includes('authentication') ||
    reason.includes('encryption') ||
    reason.includes('pair') ||
    reason.includes('bond') ||
    message.includes('authentication') ||
    message.includes('encryption') ||
    message.includes('pair') ||
    message.includes('bond');
  if (hasPairingHint) {
    return true;
  }

  const isUnknownAtt = attError === 128 || reason.includes('unknown att error') || message.includes('unknown att error');
  return isUnknownAtt;
};
const delay = (timers: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout }, ms: number) => {
  return new Promise<void>((resolve) => {
    timers.setTimeout(resolve, ms);
  });
};

const isBenignWriteError = (error: unknown) => {
  const candidate = error as { errorCode?: unknown; attErrorCode?: unknown; reason?: unknown; message?: unknown };
  if (candidate?.errorCode !== BleErrorCode.CharacteristicWriteFailed) {
    return false;
  }
  const lower = (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : '');

  if (candidate.attErrorCode === 128) {
    // Swift demo (BluetoothManager.didWriteValueFor) logs CBATTErrorDomain code=128 during pairing,
    // then still receives FF12 notifications, so we treat it as benign.
    return true;
  }

  const reason = lower(candidate.reason);
  const message = lower(candidate.message);
  return reason.includes('unknown att error') || message.includes('unknown att error');
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
  aid?: HexString;
  selectAid?: boolean;
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
  const queue = createAsyncQueue();

  let isOpen = false;
  let connectedDeviceId: string | undefined;
  let serviceUuid: string | undefined;
  let writeUuid: string | undefined;
  let notifyUuid: string | undefined;
  let monitorSubscription: Subscription | undefined;
  let disconnectSubscription: Subscription | undefined;
  let pendingResponse: PendingResponse | undefined;
  let encryption: BleEncryption = passthroughEncryption;

  let currentAid: HexString | undefined;

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
    if (current.timeoutId) {
      timers.clearTimeout(current.timeoutId);
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

    const controller = pendingResponse;
    if (frame.length === 0) {
      return;
    }
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

      const managerInstance = ensureManager();

      const {
        deviceId,
        scanTimeoutMs = DEFAULT_SCAN_TIMEOUT_MS,
        connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
        responseTimeoutMs = DEFAULT_RESPONSE_TIMEOUT_MS,
        filter,
        encryptionKey,
        aid = BSIM_AID,
        selectAid = true,
      } = options ?? {};

      let normalizedAid: HexString;
      try {
        normalizedAid = normalizeHex(aid);
      } catch (error) {
        throw new TransportError(TransportErrorCode.INVALID_APDU_PAYLOAD, (error as Error).message ?? 'Invalid AID', {
          cause: error,
        });
      }

      if (!isOpen) {
        await waitForAdapterReady(managerInstance, scanTimeoutMs, timers, logger);

        if (encryptionKey && !deps.encryptionFactory) {
          throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'BLE encryption key provided but no encryptionFactory was configured');
        }
        encryption = encryptionKey ? deps.encryptionFactory!(fromHex(encryptionKey)) : passthroughEncryption;

        let device: Device;
        if (deviceId) {
          device = await withTimeout(
            timers,
            connectTimeoutMs,
            () => managerInstance.connectToDevice(deviceId, { autoConnect: false }),
            () => new TransportError(TransportErrorCode.CHANNEL_OPEN_FAILED, 'BLE connection timeout'),
          );
        } else {
          device = await scanForDevice(managerInstance, scanTimeoutMs, identifiers, timers, filter, logger);
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
          currentAid = undefined;
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
          const decoded = fromBase64(characteristic.value);
          try {
            handleIncomingFrame(decoded);
          } catch (err) {
            cleanupPending(err);
          }
        });

        isOpen = true;
      } else {
        if (deviceId && deviceId !== connectedDeviceId) {
          throw new TransportError(TransportErrorCode.CHANNEL_ALREADY_OPEN, 'BLE channel already open for a different device');
        }
        if (encryptionKey && !deps.encryptionFactory) {
          throw new TransportError(TransportErrorCode.UNSUPPORTED_PLATFORM, 'BLE encryption key provided but no encryptionFactory was configured');
        }
      }

      const rawTransmit = (payload: string) => {
        const normalized = normalizeHex(payload);

        return queue.enqueue(async () => {
          if (!isOpen || !connectedDeviceId || !serviceUuid || !writeUuid) {
            throw new TransportError(TransportErrorCode.CHANNEL_NOT_OPEN, 'BLE channel is not open');
          }
          if (pendingResponse) {
            throw new TransportError(TransportErrorCode.SESSION_BUSY, 'Another BLE operation is still pending');
          }

          const frames = buildOutgoingFrames(normalized, encryption);

          const timeoutMs = responseTimeoutMs > 0 ? responseTimeoutMs : DEFAULT_RESPONSE_TIMEOUT_MS;

          const createPendingResponse = (timeout: number) => {
            let resolvePending: (value: Uint8Array) => void;
            let rejectPending: (error: unknown) => void;

            const promise = new Promise<Uint8Array>((resolve, reject) => {
              resolvePending = resolve;
              rejectPending = reject;
            });

            pendingResponse = {
              resolve: (value) => {
                if (pendingResponse?.timeoutId) {
                  timers.clearTimeout(pendingResponse.timeoutId);
                }
                pendingResponse = undefined;
                resolvePending(value);
              },
              reject: (error) => {
                if (pendingResponse?.timeoutId) {
                  timers.clearTimeout(pendingResponse.timeoutId);
                }
                pendingResponse = undefined;
                rejectPending(error);
              },
              buffer: new Uint8Array(0),
              expectedFrames: 0,
              lastSequence: -1,
              timeoutId: undefined,
            };
            const startTimer = () => {
              if (!pendingResponse || pendingResponse.timeoutId || timeout <= 0) {
                return;
              }
              pendingResponse.timeoutId = timers.setTimeout(() => {
                cleanupPending(new TransportError(TransportErrorCode.READ_TIMEOUT, 'BLE response timeout'));
              }, timeout);
            };

            return { promise, startTimer };
          };

          const pending = createPendingResponse(timeoutMs);

          const writeFrame = async (frame: Uint8Array) => {
            const base64 = toBase64(frame);
            for (let attempt = 0; attempt <= MAX_PAIRING_RETRIES; attempt += 1) {
              try {
                await managerInstance.writeCharacteristicWithResponseForDevice(connectedDeviceId!, serviceUuid!, writeUuid!, base64);
                return;
              } catch (error) {
                const benign = isBenignWriteError(error);
                const retryable = !benign && shouldRetryPairing(error);
                if (benign) {
                  return;
                }
                if (!retryable || attempt === MAX_PAIRING_RETRIES) {
                  throw error;
                }
                logger('ble.write.retry_pairing', { attempt: attempt + 1, deviceId: connectedDeviceId, error });
                try {
                  await managerInstance.discoverAllServicesAndCharacteristicsForDevice(connectedDeviceId!);
                  const refreshed = await ensureCharacteristics(managerInstance, connectedDeviceId!, identifiers);
                  serviceUuid = refreshed.serviceUuid;
                  writeUuid = refreshed.writeUuid;
                  notifyUuid = refreshed.notifyUuid;
                } catch (refreshError) {
                  logger('ble.write.refresh_failed', { deviceId: connectedDeviceId, error: refreshError });
                }
                await delay(timers, PAIRING_RETRY_DELAY_MS);
              }
            }
          };

          try {
            for (const frame of frames) {
              await writeFrame(frame);
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

          pending.startTimer();

          const rawResponse = await pending.promise;
          return decodeIncomingPayload(rawResponse, encryption);
        });
      };

      const performSelectAid = async (aidToSelect: HexString) => {
        const context = { deviceId: connectedDeviceId, serviceUuid, writeUuid, aid: aidToSelect };
        logger('ble.select_aid.start', context);
        try {
          const rawResponse = await rawTransmit(buildSelectCommand(aidToSelect));
          const parsed = parseApduResponse(rawResponse);

          if (parsed.status === 'success') {
            logger('ble.select_aid.success', context);
            return;
          }

          if (parsed.status === 'pending') {
            throw new TransportError(TransportErrorCode.SELECT_AID_FAILED, 'BSIM required additional APDU exchange during AID selection', {
              details: { status: APDU_STATUS.PENDING },
            });
          }

          throw new TransportError(TransportErrorCode.SELECT_AID_FAILED, parsed.message ?? `AID selection failed with status ${parsed.code}`, {
            details: { code: parsed.code },
          });
        } catch (error) {
          const transportError = isTransportError(error)
            ? error
            : new TransportError(TransportErrorCode.SELECT_AID_FAILED, (error as { message?: string })?.message ?? 'Failed to select BSIM AID', {
                cause: error,
              });
          logger('ble.select_aid.error', { ...context, error: transportError });
          throw transportError;
        }
      };
      const sessionAid = normalizedAid;

      const ensureAidSelectedForSession = async () => {
        if (!selectAid) {
          return;
        }

        if (currentAid && currentAid === sessionAid) {
          return;
        }

        try {
          await performSelectAid(sessionAid);
          currentAid = sessionAid;
        } catch (error) {
          isOpen = false;
          currentAid = undefined;
          await queue.flush();
          await teardown();
          queue.reset();
          throw error;
        }
      };

      await ensureAidSelectedForSession();

      const close = async () => {
        if (!isOpen) {
          return;
        }
        isOpen = false;
        currentAid = undefined;

        await queue.flush();
        await teardown();
        queue.reset();
      };

      const transmit = async (payload: string) => {
        await ensureAidSelectedForSession();
        return rawTransmit(payload);
      };
      return {
        transmit,
        close,
      };
    },
  };
};
