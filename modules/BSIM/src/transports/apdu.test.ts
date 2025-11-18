import { BSIM_AID, ICCID_AID } from '../core/params';
import { createApduTransport } from './apdu';
import { TransportErrorCode } from './errors';

type NativeModuleMock = {
  openApduChannel: jest.Mock<Promise<void>, [string]>;
  closeApduChannel: jest.Mock<Promise<void>, []>;
  transmitApdu: jest.Mock<Promise<string>, [string]>;
};

const createNativeMock = (): NativeModuleMock => ({
  openApduChannel: jest.fn<Promise<void>, [string]>(() => Promise.resolve()),
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
    jest.clearAllMocks();
  });

  it('opens channel , select default AID and allows transmit / close', async () => {
    const native = createNativeMock();

    native.transmitApdu.mockResolvedValueOnce('BEFF9000');

    const transport = createApduTransport({ nativeModule: native, platform: 'android' });
    const session = await transport.open();

    expect(native.openApduChannel).toHaveBeenCalledTimes(1);
    expect(native.openApduChannel).toHaveBeenCalledWith(BSIM_AID);
    expect(native.transmitApdu).not.toHaveBeenCalled();

    await expect(session.transmit('00')).resolves.toBe('BEFF9000');
    expect(native.transmitApdu).toHaveBeenCalledTimes(1);
    expect(native.transmitApdu).toHaveBeenCalledWith('00');
  });

  it('fails to open on unsupported platform', async () => {
    const transport = createApduTransport({ platform: 'ios' });

    await expect(transport.open()).rejects.toMatchObject({
      code: TransportErrorCode.UNSUPPORTED_PLATFORM,
    });
  });

  it('serializes concurrent transmit calls', async () => {
    const native = createNativeMock();

    const firstDeferred = createDeferred<string>();
    native.transmitApdu.mockImplementationOnce(() => firstDeferred.promise);
    native.transmitApdu.mockImplementationOnce(async () => 'BBFF9000');

    const transport = createApduTransport({ nativeModule: native, platform: 'android' });
    const session = await transport.open();

    expect(native.transmitApdu).not.toHaveBeenCalled();

    const firstTransmit = session.transmit('AA');
    await Promise.resolve(); // let transmitApdu be called

    expect(native.transmitApdu).toHaveBeenCalledTimes(1);
    expect(native.transmitApdu.mock.calls[0][0]).toBe('AA');

    const secondTransmit = session.transmit('BB');
    await Promise.resolve();

    expect(native.transmitApdu).toHaveBeenCalledTimes(1);

    firstDeferred.resolve('AAFF9000');
    await expect(firstTransmit).resolves.toBe('AAFF9000');

    await Promise.resolve();
    expect(native.transmitApdu).toHaveBeenCalledTimes(2);
    expect(native.transmitApdu.mock.calls[1][0]).toBe('BB');

    await expect(secondTransmit).resolves.toBe('BBFF9000');

    await session.close();
  });
});
