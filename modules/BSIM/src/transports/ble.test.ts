jest.mock('react-native-ble-plx', () => {
  class BleError extends Error {
    constructor(message = '') {
      super(message);
      this.name = 'BleError';
    }
  }
  class BleManager {}

  return {
    __esModule: true,
    BleError,
    BleManager,
  };
});

import { toHex } from '../core/utils';
import { createBleTransport } from './ble';
import { TransportErrorCode } from './errors';

type MonitorCallback = (error: unknown, characteristic: { value?: string | null } | null) => void;
type DisconnectCallback = (error: unknown) => void;
type ScanCallback = (error: unknown, device: { id: string; name?: string } | null) => void;

const createFakeTimers = () => {
  let nextId = 1;
  const pending = new Map<number, () => void>();

  const fakeSetTimeout = ((callback: (...args: unknown[]) => void) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, () => callback());
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  if ('__promisify__' in setTimeout) {
    (fakeSetTimeout as typeof setTimeout & { __promisify__?: typeof setTimeout.__promisify__ }).__promisify__ = setTimeout.__promisify__;
  }

  const fakeClearTimeout = ((handle: ReturnType<typeof setTimeout>) => {
    pending.delete(handle as unknown as number);
  }) as typeof clearTimeout;

  const flushAll = () => {
    const callbacks = Array.from(pending.values());
    pending.clear();
    for (const callback of callbacks) {
      callback();
    }
  };

  return { timers: { setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout }, flushAll };
};

type MockConfig = {
  serviceUuid?: string;
  characteristics?: string[];
  services?: Array<{ uuid: string }>;
};

const createMockManager = (config: MockConfig = {}) => {
  let monitorCallback: MonitorCallback | null = null;
  let disconnectCallback: DisconnectCallback | null = null;
  let scanCallback: ScanCallback | null = null;
  const writtenFrames: string[] = [];
  let pendingWriteError: unknown | null = null;

  const manager = {
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
      if (pendingWriteError) {
        const error = pendingWriteError;
        pendingWriteError = null;
        throw error;
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
    pendingWriteError = error;
  };

  return {
    manager: manager as unknown as import('react-native-ble-plx').BleManager,
    writtenFrames,
    emitNotification,
    emitScanResult,
    emitScanError,
    triggerDisconnect,
    failNextWrite,
  };
};

const decodeBase64 = (base64: string) => Uint8Array.from(Buffer.from(base64, 'base64'));

const xorCipherFactory = (mask: number) => ({
  encrypt: (payload: Uint8Array) => Uint8Array.from(payload.map((byte) => byte ^ mask)),
  decrypt: (payload: Uint8Array) => Uint8Array.from(payload.map((byte) => byte ^ mask)),
});

describe('createBleTransport', () => {
  it('transmits APDU frames and resolves response', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const session = await transport.open({ deviceId: 'mock-device', responseTimeoutMs: 5_000 });

    const transmitPromise = session.transmit('80AC000000');

    await Promise.resolve();
    expect(mock.writtenFrames.length).toBeGreaterThan(0);

    mock.emitNotification([0x10, 0x12, 0x00, 0x02, 0x90, 0x00]);

    await expect(transmitPromise).resolves.toBe('9000');

    await session.close();
  });

  it('reassembles multi-frame responses', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const session = await transport.open({ deviceId: 'mock-device' });

    const payload = Uint8Array.from({ length: 20 }, (_, index) => index);
    const body = Uint8Array.of(0x12, 0x00, payload.length, ...payload);
    const firstFrame = [0x20, ...body.slice(0, 19)];
    const secondFrame = [0x21, ...body.slice(19)];

    const pending = session.transmit('80AC000000');
    await Promise.resolve();

    mock.emitNotification(firstFrame);
    mock.emitNotification(secondFrame);

    await expect(pending).resolves.toBe(toHex(payload));

    await session.close();
  });

  it('rejects when frame sequence is invalid', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const session = await transport.open({ deviceId: 'mock-device' });

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

  it('uses provided encryptionFactory for request/response', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({
      manager: mock.manager,
      timers: timers.timers,
      encryptionFactory: (key) => xorCipherFactory(key[0] ?? 0x00),
    });

    const session = await transport.open({ deviceId: 'mock-device', encryptionKey: 'AA', responseTimeoutMs: 5_000 });

    const pending = session.transmit('0102');
    await Promise.resolve();

    const written = decodeBase64(mock.writtenFrames[0]);
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
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

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
    const timers = createFakeTimers();
    const transport = createBleTransport({
      manager: mock.manager,
      timers: timers.timers,
      identifiers: {
        serviceUuid: 'FF10',
        writeCharacteristicUuid: 'FF11',
        notifyCharacteristicUuid: 'ff12',
      },
    });

    const session = await transport.open({ deviceId: 'mock-device' });
    await session.close();

    expect(mock.manager.characteristicsForDevice).toHaveBeenCalled();
  });

  it('queues transmit calls sequentially', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const session = await transport.open({ deviceId: 'mock-device', responseTimeoutMs: 5_000 });

    const first = session.transmit('80AC000000');
    await Promise.resolve();

    const writesAfterFirst = mock.writtenFrames.length;
    expect(writesAfterFirst).toBeGreaterThan(0);

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

  it('propagates write errors as TransportError WRITE_FAILED', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const session = await transport.open({ deviceId: 'mock-device' });

    mock.failNextWrite(new Error('write boom'));
    await expect(session.transmit('80AC000000')).rejects.toMatchObject({
      code: TransportErrorCode.WRITE_FAILED,
    });

    await session.close();
  });

  it('rejects pending transmit when device disconnects', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const session = await transport.open({ deviceId: 'mock-device', responseTimeoutMs: 5_000 });

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
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const session = await transport.open({ deviceId: 'mock-device', responseTimeoutMs: 1 });

    const pending = session.transmit('80AC000000');
    await Promise.resolve();

    timers.flushAll();

    await expect(pending).rejects.toMatchObject({
      code: TransportErrorCode.READ_TIMEOUT,
    });

    await session.close();
  });

  it('fails to open when scan times out', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const openPromise = transport.open({ scanTimeoutMs: 1, responseTimeoutMs: 5_000 });
    await Promise.resolve();

    timers.flushAll();

    await expect(openPromise).rejects.toMatchObject({
      code: TransportErrorCode.SCAN_FAILED,
    });
  });

  it('fails to open when scan returns error', async () => {
    const mock = createMockManager();
    const timers = createFakeTimers();
    const transport = createBleTransport({ manager: mock.manager, timers: timers.timers });

    const openPromise = transport.open({});
    await Promise.resolve();

    mock.emitScanError(new Error('scan fail'));

    await expect(openPromise).rejects.toMatchObject({
      code: TransportErrorCode.SCAN_FAILED,
    });
  });
});
