import { createApduTransport } from './apdu';
import { TransportErrorCode } from './errors';

type NativeModuleMock = {
  openApduChannel: jest.Mock<Promise<void>, []>;
  closeApduChannel: jest.Mock<Promise<void>, []>;
  transmitApdu: jest.Mock<Promise<string>, [string]>;
};

const DEFAULT_SELECT_APDU = '00A4040010A000000533C000FF860000000000054D';

const createNativeMock = (): NativeModuleMock => ({
  openApduChannel: jest.fn<Promise<void>, []>(() => Promise.resolve()),
  closeApduChannel: jest.fn<Promise<void>, []>(() => Promise.resolve()),
  transmitApdu: jest.fn<Promise<string>, [string]>(),
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('createApduTransport', () => {
  afterEach(() => {
    jest.clearAllMocks;
  });

  it('opens channel , select default AID and allows transmit / close', async () => {
    const native = createNativeMock();

    native.transmitApdu.mockResolvedValueOnce('9000');
    native.transmitApdu.mockResolvedValueOnce('BEFF9000');

    const transport = createApduTransport({ nativeModule: native, platform: 'android' });
    const session = await transport.open();

    expect(native.openApduChannel).toHaveBeenCalledTimes(1);
    expect(native.transmitApdu).toHaveBeenCalledTimes(1);
    expect(native.transmitApdu).toHaveBeenCalledWith(DEFAULT_SELECT_APDU);

    await expect(session.transmit('00')).resolves.toBe('BEFF9000');
    expect(native.transmitApdu).toHaveBeenCalledTimes(2);

    await session.close();
    expect(native.closeApduChannel).toHaveBeenCalledTimes(1);
  });

  it('fails to open on unsupported platform', async () => {
    const transport = createApduTransport({ platform: 'ios' });

    await expect(transport.open()).rejects.toMatchObject({
      code: TransportErrorCode.UNSUPPORTED_PLATFORM,
    });
  });

  it('serializes concurrent transmit calls', async () => {
    const native = createNativeMock();
    native.transmitApdu.mockResolvedValueOnce('9000');

    const firstDeferred = createDeferred<string>();
    native.transmitApdu.mockImplementationOnce(() => firstDeferred.promise);
    native.transmitApdu.mockImplementationOnce(async () => 'BBFF9000');

    const transport = createApduTransport({ nativeModule: native, platform: 'android' });
    const session = await transport.open();

    expect(native.transmitApdu).toHaveBeenCalledTimes(1);

    const firstTransmit = session.transmit('AA');
    await Promise.resolve(); // let transmitApdu be called

    expect(native.transmitApdu).toHaveBeenCalledTimes(2);
    expect(native.transmitApdu.mock.calls[1][0]).toBe('AA');

    const secondTransmit = session.transmit('BB');
    await Promise.resolve();

    expect(native.transmitApdu).toHaveBeenCalledTimes(2);

    firstDeferred.resolve('AAFF9000');
    await expect(firstTransmit).resolves.toBe('AAFF9000');

    await Promise.resolve();
    expect(native.transmitApdu).toHaveBeenCalledTimes(3);
    expect(native.transmitApdu.mock.calls[2][0]).toBe('BB');

    await expect(secondTransmit).resolves.toBe('BBFF9000');

    await session.close();
  });

  it('skips SELECT when autoSelectAid is disabled', async () => {
    const native = createNativeMock();

    const transport = createApduTransport({ nativeModule: native, platform: 'android' });
    const session = await transport.open({ autoSelectAid: false });

    expect(native.transmitApdu).not.toHaveBeenCalled();

    await session.close();
    expect(native.closeApduChannel).toHaveBeenCalledTimes(1);
  });
});
