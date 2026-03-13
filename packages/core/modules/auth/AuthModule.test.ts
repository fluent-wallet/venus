import 'reflect-metadata';

import { CORE_IDENTIFIERS } from '@core/di';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { ModuleManager } from '@core/runtime/ModuleManager';
import { createPassthroughTestCryptoTool, createSilentLogger, createStrictTestCryptoTool } from '@core/testUtils/mocks';
import type { CryptoTool } from '@core/types/crypto';
import { Container } from 'inversify';
import { createCryptoToolModule } from '../crypto';
import { createDbModule } from '../db';
import { EventBusModule } from '../eventBus';
import { AuthModule } from './AuthModule';
import { AuthService } from './AuthService';
import { AUTH_REASON } from './reasons';

function createTestRuntime(params?: { cryptoTool?: CryptoTool; vaults?: Array<{ type: string; data?: string | null }> }) {
  type MinimalDatabase = Parameters<typeof createDbModule>[0]['database'];
  const vaults = params?.vaults ?? [];
  const database: {
    get: jest.Mock;
    localStorage: {
      get: jest.Mock;
      set: jest.Mock;
      remove: jest.Mock;
    };
  } = {
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () => vaults),
      })),
    })),
    localStorage: {
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      remove: jest.fn(async () => undefined),
    },
  };

  const container = new Container({ defaultScope: 'Singleton' });
  const manager = new ModuleManager({
    logger: createSilentLogger(),
    container,
    config: { auth: { passwordRequestTtlMs: 10_000 } },
  });

  manager.register([
    createDbModule({ database: database as unknown as MinimalDatabase }),
    createCryptoToolModule({ cryptoTool: params?.cryptoTool ?? createPassthroughTestCryptoTool() }),
    EventBusModule,
    AuthModule,
  ]);

  return { container, manager, database };
}

describe('AuthModule', () => {
  it('binds AuthService into runtime container', async () => {
    const { container, manager } = createTestRuntime();
    await manager.start();

    const service = container.get<AuthService>(CORE_IDENTIFIERS.AUTH);
    expect(service).toBeInstanceOf(AuthService);

    await manager.stop();
  });

  it('stop() cancels pending password request', async () => {
    const { container, manager } = createTestRuntime();
    await manager.start();

    const auth = container.get<AuthService>(CORE_IDENTIFIERS.AUTH);

    const pending = auth.getPassword({ reason: AUTH_REASON.SIGN_TX });

    await manager.stop();

    await expect(pending).rejects.toMatchObject({ code: AUTH_PASSWORD_REQUEST_CANCELED });
  });

  it('loads the legacy persisted biometrics preference', async () => {
    const { container, manager, database } = createTestRuntime();
    database.localStorage.get.mockResolvedValue('Biometrics');

    await manager.start();

    const auth = container.get<AuthService>(CORE_IDENTIFIERS.AUTH);
    const requested: Array<{ requestId: string; kind: 'password' | 'biometrics' }> = [];
    const eventBus = container.get(CORE_IDENTIFIERS.EVENT_BUS) as {
      on: (
        eventName: 'auth/credential-requested',
        listener: (payload: { requestId: string; kind: 'password' | 'biometrics' }) => void,
      ) => { unsubscribe: () => void };
    };

    const sub = eventBus.on('auth/credential-requested', (payload) => {
      requested.push(payload);
    });

    const pending = auth.getPassword({ reason: AUTH_REASON.SIGN_TX });

    expect(requested).toHaveLength(1);
    expect(requested[0].kind).toBe('biometrics');

    auth.cancelPasswordRequest({ requestId: requested[0].requestId });
    await expect(pending).rejects.toMatchObject({ code: AUTH_PASSWORD_REQUEST_CANCELED });

    sub.unsubscribe();
    await manager.stop();
  });

  it('verifies password through the real AuthModule wiring', async () => {
    const cryptoTool = createStrictTestCryptoTool();
    const encryptedMnemonic = await cryptoTool.encrypt('mnemonic', 'correct-password');
    const { container, manager } = createTestRuntime({
      cryptoTool,
      vaults: [{ type: 'hierarchical_deterministic', data: encryptedMnemonic }],
    });

    await manager.start();

    const auth = container.get<AuthService>(CORE_IDENTIFIERS.AUTH);

    await expect(auth.verifyPassword('correct-password')).resolves.toBe(true);
    await expect(auth.verifyPassword('wrong-password')).resolves.toBe(false);

    await manager.stop();
  });
});
