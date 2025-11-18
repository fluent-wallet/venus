jest.mock('react-native-ble-plx', () => {
  class BleError extends Error {}
  class BleManager {}
  return { BleError, BleManager };
});

import { createWallet } from './wallet';
import { TransportError, TransportErrorCode } from './transports/errors';
import type { Transport, TransportSession } from './transports/types';
import type { ApduTransportOptions } from './transports/apdu';
import type { BleTransportOptions } from './transports/ble';
import { ApduFlowError } from './core/workflows';
import { DEFAULT_SIGNATURE_ALGORITHM } from './constants';
import { buildDerivePrivateKey, buildGetIccid, buildGetVersion, buildUpdateBpin, buildVerifyBpin, serializeCommand } from './core/params';

type ScriptStep = { expect: string; reply: string };

const createScriptSession = (script: ScriptStep[]): TransportSession => {
  let step = 0;

  return {
    transmit: jest.fn(async (payload: string) => {
      const current = script[step];
      expect(current).toBeDefined();
      expect(payload).toBe(current.expect);
      step += 1;
      return current.reply;
    }),
    close: jest.fn(async () => undefined),
  };
};

const createApduMockTransport = (openImpl: () => Promise<TransportSession>): Transport<ApduTransportOptions> => ({
  kind: 'apdu',
  open: jest.fn(openImpl),
});

const createBleMockTransport = (openImpl: () => Promise<TransportSession>): Transport<BleTransportOptions> => ({
  kind: 'ble',
  open: jest.fn(openImpl),
});

describe('wallet', () => {
  it('verifies BPIN through the primary transport', async () => {
    const session = createScriptSession([{ expect: serializeCommand(buildVerifyBpin()), reply: '9000' }]);
    const transport = createApduMockTransport(async () => session);
    const wallet = createWallet({ transports: [{ kind: 'apdu', transport }], idleTimeoutMs: 0 });

    await expect(wallet.verifyBpin()).resolves.toBeUndefined();
    expect(session.transmit).toHaveBeenCalledTimes(1);
    expect(session.close).not.toHaveBeenCalled();
  });

  it('falls back to next transport when the first one fails to open', async () => {
    const failingTransport = createApduMockTransport(async () => {
      throw new TransportError(TransportErrorCode.CHANNEL_OPEN_FAILED, 'boom');
    });
    const session = createScriptSession([{ expect: serializeCommand(buildVerifyBpin()), reply: '9000' }]);
    const fallbackTransport = createBleMockTransport(async () => session);

    const wallet = createWallet({
      transports: [
        { kind: 'apdu', transport: failingTransport },
        { kind: 'ble', transport: fallbackTransport },
      ],
      idleTimeoutMs: 0,
    });

    await expect(wallet.verifyBpin()).resolves.toBeUndefined();

    expect(failingTransport.open).toHaveBeenCalledTimes(1);
    expect(fallbackTransport.open).toHaveBeenCalledTimes(1);
    expect(session.close).not.toHaveBeenCalled();
  });

  it('rejects concurrent sessions with SESSION_BUSY', async () => {
    const session = createScriptSession([{ expect: serializeCommand(buildVerifyBpin()), reply: '9000' }]);
    const transport = createApduMockTransport(async () => session);
    const wallet = createWallet({ transports: [{ kind: 'apdu', transport }], idleTimeoutMs: 0 });

    let release!: () => void;
    const first = wallet.runSession(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    await expect(wallet.verifyBpin()).rejects.toMatchObject({ code: TransportErrorCode.SESSION_BUSY });

    release();
    await first;
  });

  it('throws CHANNEL_OPEN_FAILED when all transports fail', async () => {
    const t1 = createApduMockTransport(async () => {
      throw new TransportError(TransportErrorCode.CHANNEL_OPEN_FAILED, 'boom1');
    });
    const t2 = createBleMockTransport(async () => {
      throw new TransportError(TransportErrorCode.CHANNEL_OPEN_FAILED, 'boom2');
    });
    const wallet = createWallet({
      transports: [
        { kind: 'apdu', transport: t1 },
        { kind: 'ble', transport: t2 },
      ],
      idleTimeoutMs: 0,
    });

    await expect(wallet.verifyBpin()).rejects.toMatchObject({ code: TransportErrorCode.CHANNEL_OPEN_FAILED });
  });

  it('propagates operation errors without falling back', async () => {
    const session = createScriptSession([{ expect: serializeCommand(buildVerifyBpin()), reply: '6A82' }]);
    const primary = createApduMockTransport(async () => session);
    const secondary = createBleMockTransport(async () => {
      throw new Error('should not open');
    });
    const wallet = createWallet({
      transports: [
        { kind: 'apdu', transport: primary },
        { kind: 'ble', transport: secondary },
      ],
      idleTimeoutMs: 0,
    });

    await expect(wallet.verifyBpin()).rejects.toBeInstanceOf(ApduFlowError);
    expect(primary.open).toHaveBeenCalledTimes(1);
    expect(secondary.open).not.toHaveBeenCalled();
  });

  it('logs transport events', async () => {
    const logger = jest.fn();
    const session = createScriptSession([{ expect: serializeCommand(buildVerifyBpin()), reply: '9000' }]);
    const transport = createApduMockTransport(async () => session);
    const wallet = createWallet({ transports: [{ kind: 'apdu', transport }], logger, idleTimeoutMs: 0 });

    await wallet.verifyBpin();

    expect(logger).toHaveBeenCalledWith('wallet.transport.opened', { kind: 'apdu' });
    expect(logger).toHaveBeenCalledWith('wallet.operation.success', expect.objectContaining({ label: 'verifyBpin' }));
  });

  it('closes idle session after the configured timeout', async () => {
    jest.useFakeTimers();
    try {
      const session = createScriptSession([{ expect: serializeCommand(buildVerifyBpin()), reply: '9000' }]);
      const transport = createApduMockTransport(async () => session);
      const wallet = createWallet({ transports: [{ kind: 'apdu', transport }], idleTimeoutMs: 100 });

      await wallet.verifyBpin();
      expect(session.close).not.toHaveBeenCalled();

      jest.advanceTimersByTime(90);
      await Promise.resolve();
      expect(session.close).not.toHaveBeenCalled();

      jest.advanceTimersByTime(20);

      expect(session.close).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('derives a new key using the default algorithm', async () => {
    const command = serializeCommand(buildDerivePrivateKey(60, DEFAULT_SIGNATURE_ALGORITHM));
    const session = createScriptSession([{ expect: command, reply: '9000' }]);
    const transport = createApduMockTransport(async () => session);
    const wallet = createWallet({ transports: [{ kind: 'apdu', transport }], idleTimeoutMs: 0 });

    await expect(wallet.deriveKey({ coinType: 60 })).resolves.toBeUndefined();
  });

  it('updates BPIN and returns ok on success', async () => {
    const command = serializeCommand(buildUpdateBpin());
    const session = createScriptSession([{ expect: command, reply: '9000' }]);
    const transport = createApduMockTransport(async () => session);
    const wallet = createWallet({ transports: [{ kind: 'apdu', transport }], idleTimeoutMs: 0 });

    await expect(wallet.updateBpin()).resolves.toBe('ok');
  });

  it('returns raw version payload', async () => {
    const command = serializeCommand(buildGetVersion());
    const payload = '313233'; // "123"
    const session = createScriptSession([{ expect: command, reply: `${payload}9000` }]);
    const transport = createApduMockTransport(async () => session);
    const wallet = createWallet({ transports: [{ kind: 'apdu', transport }], idleTimeoutMs: 0 });

    await expect(wallet.getVersion()).resolves.toBe(payload);
  });

  it('returns raw ICCID payload', async () => {
    const command = serializeCommand(buildGetIccid());
    const payload = '89860123456789012345';
    const session = createScriptSession([{ expect: command, reply: `${payload}9000` }]);
    const transport = createApduMockTransport(async () => session);
    const wallet = createWallet({ transports: [{ kind: 'apdu', transport }], idleTimeoutMs: 0 });

    await expect(wallet.getIccid()).resolves.toBe(payload);
  });
});
