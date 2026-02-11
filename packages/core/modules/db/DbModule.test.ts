import 'reflect-metadata';

import { mockDatabase } from '@core/database/testUtils/mockDatabases';
import { CORE_IDENTIFIERS } from '@core/di';
import { ModuleManager } from '@core/runtime/ModuleManager';
import { createSilentLogger } from '@core/testUtils/mocks';
import { Container } from 'inversify';
import { createDbModule } from './DbModule';

describe('DbModule', () => {
  it('binds provided database into runtime container', async () => {
    const database = mockDatabase();
    const container = new Container({ defaultScope: 'Singleton' });

    const manager = new ModuleManager({ logger: createSilentLogger(), container });
    manager.register(createDbModule({ database }));

    await manager.start();

    expect(container.get(CORE_IDENTIFIERS.DB)).toBe(database);

    await manager.stop();
  });

  it('does not override existing DB binding (supports test doubles)', async () => {
    const existing = mockDatabase();
    const database = mockDatabase();
    const container = new Container({ defaultScope: 'Singleton' });

    container.bind(CORE_IDENTIFIERS.DB).toConstantValue(existing);

    const manager = new ModuleManager({ logger: createSilentLogger(), container });
    manager.register(createDbModule({ database }));

    await manager.start();

    expect(container.get(CORE_IDENTIFIERS.DB)).toBe(existing);

    await manager.stop();
  });
});
