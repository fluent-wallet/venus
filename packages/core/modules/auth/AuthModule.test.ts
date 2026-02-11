import 'reflect-metadata';

import { createSilentLogger } from '@core/testUtils/mocks';
import { CORE_IDENTIFIERS } from '@core/di';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { ModuleManager } from '@core/runtime/ModuleManager';
import { Container } from 'inversify';
import { EventBusModule } from '../eventBus';
import { AuthModule } from './AuthModule';
import { AuthService } from './AuthService';
import { AUTH_REASON } from './reasons';

describe('AuthModule', () => {
  it('binds AuthService into runtime container', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: { auth: { passwordRequestTtlMs: 10_000 } },
    });

    manager.register([EventBusModule, AuthModule]);
    await manager.start();

    const service = container.get<AuthService>(CORE_IDENTIFIERS.AUTH);
    expect(service).toBeInstanceOf(AuthService);

    await manager.stop();
  });

  it('stop() cancels pending password request', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: { auth: { passwordRequestTtlMs: 10_000 } },
    });

    manager.register([EventBusModule, AuthModule]);
    await manager.start();

    const auth = container.get<AuthService>(CORE_IDENTIFIERS.AUTH);

    const pending = auth.getPassword({ reason: AUTH_REASON.SIGN_TX });

    await manager.stop();

    await expect(pending).rejects.toMatchObject({ code: AUTH_PASSWORD_REQUEST_CANCELED });
  });
});
