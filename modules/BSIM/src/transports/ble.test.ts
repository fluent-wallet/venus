jest.mock('react-native-ble-plx', () => {
  let bleManagerMockInstance: unknown = null;

  const __setMockBleManager = (instance: unknown) => {
    bleManagerMockInstance = instance;
  };

  function BleManager(this: unknown) {
    return bleManagerMockInstance as any;
  }

  class BleError extends Error {
    constructor(message = '') {
      super(message);
      this.name = 'BleError';
    }
  }

  return {
    __esModule: true,
    BleError,
    BleManager,
    __setMockBleManager,
    State: {
      Unknown: 'Unknown',
      Resetting: 'Resetting',
      Unsupported: 'Unsupported',
      Unauthorized: 'Unauthorized',
      PoweredOff: 'PoweredOff',
      PoweredOn: 'PoweredOn',
    },
    BleErrorCode: {
      CharacteristicWriteFailed: 401,
    },
    BleATTErrorCode: {
      InsufficientAuthentication: 5,
      InsufficientEncryption: 15,
      InsufficientEncryptionKeySize: 12,
    },
  };
});

import { BleATTErrorCode, BleErrorCode, State } from 'react-native-ble-plx';
import { BSIM_AID, ICCID_AID } from '../core/params';
import { toHex } from '../core/utils';
import { type BleTransportOptions, createBleTransport, startBleDeviceScan } from './ble';
import { TransportErrorCode } from './errors';

type MonitorCallback = (error: unknown, characteristic: { value?: string | null } | null) => void;
type DisconnectCallback = (error: unknown) => void;
type ScanCallback = (error: unknown, device: { id: string; name?: string } | null) => void;

const flushMicrotasks = async (iterations = 2) => {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
};

const HANDSHAKE_SELECT_AID_HEX = `00A4040010${BSIM_AID}`;
const HANDSHAKE_SELECT_ICCID_HEX = `00A4040007${ICCID_AID}`;
const buildSelectAidResponseFrame = (status: Uint8Array): number[] => [0x10, 0x12, (status.length >> 8) & 0xff, status.length & 0xff, ...status];
const SELECT_AID_RESPONSE_FRAME = buildSelectAidResponseFrame(Uint8Array.of(0x90, 0x00));

const buildTransport = (mock: ReturnType<typeof createMockManager>, overrides: Parameters<typeof createBleTransport>[0] = {}) => {
  return createBleTransport({ manager: mock.manager, timers: { setTimeout, clearTimeout }, ...overrides });
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

type MockConfig = {
  serviceUuid?: string;
  characteristics?: string[];
  services?: Array<{ uuid: string }>;
  initialState?: State;
};

const createMockManager = (config: MockConfig = {}) => {
  let monitorCallback: MonitorCallback | null = null;
  let disconnectCallback: DisconnectCallback | null = null;
  let scanCallback: ScanCallback | null = null;
  const stateListeners = new Set<(state: State) => void>();
  const writtenFrames: string[] = [];
  const pendingWriteErrors: unknown[] = [];
  const pendingStateEmits: State[] = [];

  const manager = {
    state: jest.fn(async () => config.initialState ?? State.PoweredOn),
    onStateChange: jest.fn((callback: (state: State) => void) => {
      stateListeners.add(callback);
      while (pendingStateEmits.length) {
        callback(pendingStateEmits.shift()!);
      }
      return { remove: jest.fn(() => stateListeners.delete(callback)) };
    }),
    connectToDevice: jest.fn(async (deviceId: string) => ({ id: deviceId, name: 'MockDevice' })),
    discoverAllServicesAndCharacteristicsForDevice: jest.fn(async () => undefined),
    servicesForDevice: jest.fn(async () => config.services ?? [{ uuid: config.serviceUuid ?? 'FF10' }]),
    characteristicsForDevice: jest.fn(async () => {
      const list = config.characteristics ?? ['FF11', 'FF12'];
      return list.map((uuid) => ({ uuid }));
    }),
    monitorCharacteristicForDevice: jest.fn((_deviceId, _serviceUuid, _notifyUuid, callback: MonitorCallback) => {
      monitorCallback = callback;
      return { remove: jest.fn() };
    }),
    writeCharacteristicWithResponseForDevice: jest.fn(async (_deviceId, _serviceUuid, _charUuid, base64: string) => {
      if (pendingWriteErrors.length > 0) {
        throw pendingWriteErrors.shift();
      }
      writtenFrames.push(base64);
      return { value: base64 };
    }),
    onDeviceDisconnected: jest.fn((_deviceId, callback: DisconnectCallback) => {
      disconnectCallback = callback;
      return { remove: jest.fn() };
    }),
    cancelDeviceConnection: jest.fn(async () => undefined),
    startDeviceScan: jest.fn((_serviceUuids, _options, callback: ScanCallback) => {
      scanCallback = callback;
    }),
    stopDeviceScan: jest.fn(() => {
      scanCallback = null;
    }),
    destroy: jest.fn(),
  };

  const emitNotification = (payload: number[]) => {
    const frame = Uint8Array.from(payload);
    const base64 = Buffer.from(frame).toString('base64');
    monitorCallback?.(null, { value: base64 });
  };

  const emitScanResult = (deviceId = 'scanned-device', name = 'MockDevice') => {
    scanCallback?.(null, { id: deviceId, name });
  };

  const emitScanError = (error: unknown) => {
    scanCallback?.(error as Error, null);
  };

  const triggerDisconnect = (error?: unknown) => {
    disconnectCallback?.(error ?? null);
  };

  const failNextWrite = (error: unknown) => {
    pendingWriteErrors.push(error);
  };

  const emitStateChange = (state: State) => {
    if (stateListeners.size === 0) {
      pendingStateEmits.push(state);
      return;
    }
    stateListeners.forEach((listener) => {
      listener(state);
    });
  };

  return {
    manager: manager as unknown as import('react-native-ble-plx').BleManager,
    writtenFrames,
    emitNotification,
    emitScanResult,
    emitScanError,
    triggerDisconnect,
    failNextWrite,
    emitStateChange,
  };
};

const decodeBase64 = (base64: string) => Uint8Array.from(Buffer.from(base64, 'base64'));

const readCommandFromFrames = (frames: string[], startIndex = 0) => {
  if (startIndex >= frames.length) {
    throw new Error('Incomplete BLE command frames');
  }

  const buffer: number[] = [];
  const firstChunk = decodeBase64(frames[startIndex]);
  const totalFrames = firstChunk[0] >> 4;

  for (let offset = 0; offset < totalFrames; offset += 1) {
    const index = startIndex + offset;
    if (index >= frames.length) {
      throw new Error('Incomplete BLE command frames');
    }
    const chunk = decodeBase64(frames[index]);
    buffer.push(...chunk.slice(1));
  }

  const body = Uint8Array.from(buffer);
  if (body.length < 3) {
    throw new Error('BLE command body too short');
  }
  const declaredLength = (body[1] << 8) | body[2];
  const payload = body.slice(3, 3 + declaredLength);

  return {
    hex: toHex(payload),
    nextIndex: startIndex + totalFrames,
  };
};

const waitForFrames = async (mock: ReturnType<typeof createMockManager>, minimumCount: number, attempts = 20) => {
  let remaining = attempts;
  while (mock.writtenFrames.length < minimumCount && remaining > 0) {
    await flushMicrotasks(4);
    remaining -= 1;
  }
};

const openSessionWithHandshake = async (
  transport: ReturnType<typeof createBleTransport>,
  mock: ReturnType<typeof createMockManager>,
  options: BleTransportOptions = {},
  handshakeResponse: number[] = SELECT_AID_RESPONSE_FRAME,
) => {
  const fullOptions: BleTransportOptions = { deviceId: 'mock-device', ...options };
  const openPromise = transport.open(fullOptions);

  await flushMicrotasks(4);
  await waitForFrames(mock, 1);

  mock.emitNotification(handshakeResponse);
  await flushMicrotasks(4);

  const session = await openPromise;
  await waitForFrames(mock, 1);

  const handshake = readCommandFromFrames(mock.writtenFrames, 0);

  return { session, handshakeFrameCount: handshake.nextIndex, handshakeCommandHex: handshake.hex };
};

const xorCipherFactory = (mask: number) => ({
  encrypt: (payload: Uint8Array) => Uint8Array.from(payload.map((byte) => byte ^ mask)),
  decrypt: (payload: Uint8Array) => Uint8Array.from(payload.map((byte) => byte ^ mask)),
});

describe('createBleTransport', () => {
  it('transmits APDU frames and resolves response', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session, handshakeFrameCount } = await openSessionWithHandshake(transport, mock, { responseTimeoutMs: 5_000 });

    const transmitPromise = session.transmit('80AC000000');

    await Promise.resolve();
    expect(mock.writtenFrames.length).toBeGreaterThan(handshakeFrameCount);

    mock.emitNotification([0x10, 0x12, 0x00, 0x02, 0x90, 0x00]);

    await expect(transmitPromise).resolves.toBe('9000');

    await session.close();
  });

  it('reassembles multi-frame responses', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session } = await openSessionWithHandshake(transport, mock);

    const payload = Uint8Array.from({ length: 20 }, (_, index) => index);
    const body = Uint8Array.of(0x12, 0x00, payload.length, ...payload);
    const firstFrame = [0x20, ...body.slice(0, 19)];
    const secondFrame = [0x21, ...body.slice(19)];

    const pending = session.transmit('80AC000000');
    await flushMicrotasks();

    mock.emitNotification(firstFrame);
    mock.emitNotification(secondFrame);

    await expect(pending).resolves.toBe(toHex(payload));

    await session.close();
  });

  it('rejects when frame sequence is invalid', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session } = await openSessionWithHandshake(transport, mock);

    const body = Uint8Array.of(0x12, 0x00, 0x02, 0x90, 0x00);
    const firstFrame = [0x20, ...body.slice(0, 4)];
    const secondFrame = [0x22, ...body.slice(4)];

    const pending = session.transmit('80AC000000');
    await Promise.resolve();

    mock.emitNotification(firstFrame);
    mock.emitNotification(secondFrame);

    await expect(pending).rejects.toMatchObject({ code: TransportErrorCode.TRANSMIT_FAILED });

    await session.close();
  });

  it('selects BSIM AID during open', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session, handshakeCommandHex, handshakeFrameCount } = await openSessionWithHandshake(transport, mock);
    expect(handshakeFrameCount).toBeGreaterThan(0);
    expect(handshakeCommandHex).toBe(HANDSHAKE_SELECT_AID_HEX);
    await session.close();
  });

  it('selects provided AID during open when aid is overridden', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session, handshakeCommandHex, handshakeFrameCount } = await openSessionWithHandshake(transport, mock, {
      deviceId: 'mock-device',
      responseTimeoutMs: 5_000,
      aid: ICCID_AID,
    });

    expect(handshakeFrameCount).toBeGreaterThan(0);
    expect(handshakeCommandHex).toBe(HANDSHAKE_SELECT_ICCID_HEX);
    await session.close();
  });
  it('uses provided encryptionFactory for request/response', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock, {
      encryptionFactory: (key) => xorCipherFactory(key[0] ?? 0x00),
    });

    const encryptedSelectResponse = buildSelectAidResponseFrame(xorCipherFactory(0xaa).encrypt(Uint8Array.of(0x90, 0x00)));
    const { session, handshakeFrameCount } = await openSessionWithHandshake(
      transport,
      mock,
      {
        encryptionKey: 'AA',
        responseTimeoutMs: 5_000,
      },
      encryptedSelectResponse,
    );

    const pending = session.transmit('0102');
    await Promise.resolve();

    const written = decodeBase64(mock.writtenFrames[handshakeFrameCount]);
    // header byte, frame type 0x02, length 0x0002, then encrypted payload
    expect(written.slice(1, 6)).toEqual(Uint8Array.of(0x02, 0x00, 0x02, 0xab, 0xa8));

    const encryptedResponseBody = xorCipherFactory(0xaa).encrypt(Uint8Array.of(0x90, 0x00));
    const responseBody = Uint8Array.of(0x12, 0x00, 0x02, ...encryptedResponseBody);
    mock.emitNotification([0x10, ...responseBody]);

    await expect(pending).resolves.toBe('9000');

    await session.close();
  });

  it('throws when notify characteristic is missing', async () => {
    const mock = createMockManager({ characteristics: ['FF11'] });
    const transport = buildTransport(mock);

    await expect(transport.open({ deviceId: 'mock-device' })).rejects.toMatchObject({
      code: TransportErrorCode.CHARACTERISTIC_NOT_FOUND,
    });
  });

  it('matches UUIDs ignoring case and dashes', async () => {
    const serviceUuid = '0000ff10-0000-1000-8000-00805f9b34fb';
    const mock = createMockManager({
      services: [{ uuid: serviceUuid }],
      characteristics: ['0000ff11-0000-1000-8000-00805f9b34fb', '0000FF12-0000-1000-8000-00805F9B34FB'],
    });
    const transport = buildTransport(mock, {
      identifiers: {
        serviceUuid: 'FF10',
        writeCharacteristicUuid: 'FF11',
        notifyCharacteristicUuid: 'ff12',
      },
    });

    const { session } = await openSessionWithHandshake(transport, mock);
    await session.close();

    expect(mock.manager.characteristicsForDevice).toHaveBeenCalled();
  });

  it('queues transmit calls sequentially', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session, handshakeFrameCount } = await openSessionWithHandshake(transport, mock, { responseTimeoutMs: 5_000 });

    const first = session.transmit('80AC000000');
    await Promise.resolve();

    const writesAfterFirst = mock.writtenFrames.length;
    expect(writesAfterFirst).toBeGreaterThan(handshakeFrameCount);

    const second = session.transmit('80AC000000');
    await Promise.resolve();

    expect(mock.writtenFrames.length).toBe(writesAfterFirst);

    mock.emitNotification([0x10, 0x12, 0x00, 0x02, 0x90, 0x00]);
    await expect(first).resolves.toBe('9000');

    await Promise.resolve();
    expect(mock.writtenFrames.length).toBeGreaterThan(writesAfterFirst);

    mock.emitNotification([0x10, 0x12, 0x00, 0x02, 0x90, 0x00]);
    await expect(second).resolves.toBe('9000');

    await session.close();
  });

  it('can skip AID selection when selectAid is false', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const session = await transport.open({
      deviceId: 'mock-device',
      selectAid: false,
      responseTimeoutMs: 5_000,
    });
    expect(mock.writtenFrames.length).toBe(0);

    await session.close();
  });

  it('propagates write errors as TransportError WRITE_FAILED', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session } = await openSessionWithHandshake(transport, mock);

    mock.failNextWrite(new Error('write boom'));
    await expect(session.transmit('80AC000000')).rejects.toMatchObject({
      code: TransportErrorCode.WRITE_FAILED,
    });

    await session.close();
  });

  it('rejects pending transmit when device disconnects', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session } = await openSessionWithHandshake(transport, mock, { responseTimeoutMs: 5_000 });

    const pending = session.transmit('80AC000000');
    await Promise.resolve();

    mock.triggerDisconnect(new Error('link lost'));

    await expect(pending).rejects.toMatchObject({
      code: TransportErrorCode.CHANNEL_NOT_OPEN,
    });

    await session.close();
  });

  it('rejects when no response arrives before timeout', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session } = await openSessionWithHandshake(transport, mock, { responseTimeoutMs: 1 });

    const pending = session.transmit('80AC000000');
    const expectation = expect(pending).rejects.toMatchObject({
      code: TransportErrorCode.READ_TIMEOUT,
    });

    await flushMicrotasks();
    await jest.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    await expectation;

    await session.close();
  });

  it('fails to open when deviceId is missing', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    await expect(transport.open({ scanTimeoutMs: 1, responseTimeoutMs: 5_000 })).rejects.toMatchObject({ code: TransportErrorCode.DEVICE_NOT_FOUND });
  });

  it('retries characteristic write while pairing completes', async () => {
    const mock = createMockManager();
    const transport = buildTransport(mock);

    const { session } = await openSessionWithHandshake(transport, mock, { responseTimeoutMs: 5_000 });
    const writeMock = mock.manager.writeCharacteristicWithResponseForDevice as unknown as jest.Mock;
    const initialCalls = writeMock.mock.calls.length;

    mock.failNextWrite({
      errorCode: BleErrorCode.CharacteristicWriteFailed,
      attErrorCode: BleATTErrorCode.InsufficientAuthentication,
      iosErrorCode: null,
      androidErrorCode: null,
      reason: 'Authentication required',
    });

    const pending = session.transmit('80AC000000');
    const expectation = expect(pending).resolves.toBe('9000');
    await flushMicrotasks();
    expect(writeMock).toHaveBeenCalledTimes(initialCalls + 1);

    await jest.advanceTimersByTimeAsync(1_000);
    await flushMicrotasks();

    mock.emitNotification([0x10, 0x12, 0x00, 0x02, 0x90, 0x00]);
    await flushMicrotasks();
    await expectation;
    expect(writeMock).toHaveBeenCalledTimes(initialCalls + 2);

    await session.close();
  });
});

describe('startBleDeviceScan', () => {
  const setPlxMockBleManager = (manager: unknown) => {
    (require('react-native-ble-plx') as any).__setMockBleManager(manager);
  };

  it('does not enable service UUID filtering by default', async () => {
    const mock = createMockManager();
    setPlxMockBleManager(mock.manager);

    const onDevice = jest.fn();
    const onError = jest.fn();

    startBleDeviceScan(undefined, onDevice, onError);

    await flushMicrotasks(4);

    expect(mock.manager.startDeviceScan).toHaveBeenCalled();
    const [serviceUuidsArg] = (mock.manager.startDeviceScan as unknown as jest.Mock).mock.calls[0];
    expect(serviceUuidsArg).toBeNull();
  });

  it('filters devices by CT prefix (case-insensitive)', async () => {
    const mock = createMockManager();
    setPlxMockBleManager(mock.manager);

    const onDevice = jest.fn();
    const onError = jest.fn();

    startBleDeviceScan(undefined, onDevice, onError);

    await flushMicrotasks(4);

    mock.emitScanResult('d1', 'XX-IGNORE');
    mock.emitScanResult('d2', 'ct-demo');
    mock.emitScanResult('d3', 'CT-demo');

    expect(onError).not.toHaveBeenCalled();
    expect(onDevice).toHaveBeenCalledTimes(2);
    expect(onDevice).toHaveBeenNthCalledWith(1, { deviceId: 'd2', name: 'ct-demo' });
    expect(onDevice).toHaveBeenNthCalledWith(2, { deviceId: 'd3', name: 'CT-demo' });
  });

  it('does not de-duplicate by name (same name, different deviceId)', async () => {
    const mock = createMockManager();
    setPlxMockBleManager(mock.manager);
    const onDevice = jest.fn();

    startBleDeviceScan(undefined, onDevice);

    await flushMicrotasks(4);

    mock.emitScanResult('d1', 'CT-SAME');
    mock.emitScanResult('d2', 'CT-SAME');

    expect(onDevice).toHaveBeenCalledTimes(2);
  });

  it('de-duplicates by deviceId and only emits again when name changes', async () => {
    const mock = createMockManager();
    setPlxMockBleManager(mock.manager);

    const onDevice = jest.fn();

    startBleDeviceScan(undefined, onDevice);

    await flushMicrotasks(4);

    mock.emitScanResult('d1', 'CT-A');
    mock.emitScanResult('d1', 'CT-A');
    mock.emitScanResult('d1', 'CT-A-NEW');

    expect(onDevice).toHaveBeenCalledTimes(2);
    expect(onDevice).toHaveBeenNthCalledWith(1, { deviceId: 'd1', name: 'CT-A' });
    expect(onDevice).toHaveBeenNthCalledWith(2, { deviceId: 'd1', name: 'CT-A-NEW' });
  });

  it('stops emitting after stop() is called', async () => {
    const mock = createMockManager();
    setPlxMockBleManager(mock.manager);
    const onDevice = jest.fn();

    const scanHandle = startBleDeviceScan(undefined, onDevice);

    await flushMicrotasks(4);

    mock.emitScanResult('d1', 'CT-A');
    scanHandle.stop();
    mock.emitScanResult('d2', 'CT-B');

    expect(onDevice).toHaveBeenCalledTimes(1);
  });

  it('calls onError once and stops scanning when scan returns error', async () => {
    const mock = createMockManager();
    setPlxMockBleManager(mock.manager);

    const onDevice = jest.fn();
    const onError = jest.fn();

    startBleDeviceScan(undefined, onDevice, onError);

    await flushMicrotasks(4);

    mock.emitScanError(new Error('scan fail'));
    mock.emitScanResult('d1', 'CT-A');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatchObject({ code: TransportErrorCode.SCAN_FAILED });
    expect(onDevice).not.toHaveBeenCalled();
  });
});
