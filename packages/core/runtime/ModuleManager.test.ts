import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
import { MM_ALREADY_STARTED, MM_CYCLE_DEPENDENCY, MM_DUPLICATE_MODULE_ID, MM_MISSING_DEPENDENCY, MM_START_FAILED, MM_STOP_FAILED } from '@core/errors';
import { Container } from 'inversify';
import { ModuleManager } from './ModuleManager';
import type { RuntimeContext, RuntimeModule } from './types';

const createModule = (overrides: Partial<RuntimeModule> & Pick<RuntimeModule, 'id'>): RuntimeModule => {
  return {
    id: overrides.id,
    dependencies: overrides.dependencies ?? [],
    register: overrides.register,
    start: overrides.start,
    stop: overrides.stop,
  };
};

describe('ModuleManager', () => {
  let manager: ModuleManager;

  beforeEach(() => {
    manager = new ModuleManager({ logger: createSilentLogger() });
  });
  it('starts modules in topological order', async () => {
    const calls: string[] = [];

    const manager = new ModuleManager({ logger: createSilentLogger() });

    const c = createModule({
      id: 'c',
      start: () => {
        calls.push('c');
      },
    });

    const b = createModule({
      id: 'b',
      dependencies: ['c'],
      start: () => {
        calls.push('b');
      },
    });

    const a = createModule({
      id: 'a',
      dependencies: ['b'],
      start: () => {
        calls.push('a');
      },
    });

    manager.register([a, c, b]);

    await manager.start();

    expect(calls).toEqual(['c', 'b', 'a']);
  });

  it('throws when dependency is missing', async () => {
    const manager = new ModuleManager({ logger: createSilentLogger() });

    manager.register(
      createModule({
        id: 'a',
        dependencies: ['missing'],
        start: () => undefined,
      }),
    );

    await expect(manager.start()).rejects.toMatchObject({
      code: MM_MISSING_DEPENDENCY,
    });
  });

  it('throws when dependency cycle exists', async () => {
    const manager = new ModuleManager({ logger: createSilentLogger() });

    manager.register([
      createModule({ id: 'a', dependencies: ['b'], start: () => undefined }),
      createModule({ id: 'b', dependencies: ['a'], start: () => undefined }),
    ]);

    await expect(manager.start()).rejects.toMatchObject({
      code: MM_CYCLE_DEPENDENCY,
    });
  });
  it('throws when module id is duplicated', () => {
    const manager = new ModuleManager({ logger: createSilentLogger() });

    manager.register(createModule({ id: 'a', start: () => undefined }));

    expect(() => manager.register(createModule({ id: 'a', start: () => undefined }))).toThrow(expect.objectContaining({ code: MM_DUPLICATE_MODULE_ID }));
  });
  it('rolls back started modules when start fails mid-way', async () => {
    const stopCalls: string[] = [];

    const aStop = jest.fn(async () => {
      stopCalls.push('a');
    });
    const bStop = jest.fn(async () => {
      stopCalls.push('b');
    });

    manager.register([
      createModule({
        id: 'a',
        start: async () => undefined,
        stop: aStop,
      }),
      createModule({
        id: 'b',
        dependencies: ['a'],
        start: async () => {
          throw new Error('boom');
        },
        stop: bStop,
      }),
    ]);

    await expect(manager.start()).rejects.toMatchObject({ code: MM_START_FAILED });

    expect(aStop).toHaveBeenCalledTimes(1);
    expect(bStop).toHaveBeenCalledTimes(0);
    expect(stopCalls).toEqual(['a']);
  });

  it('stop is best-effort and aggregates failures', async () => {
    const stopCalls: string[] = [];

    manager.register([
      createModule({
        id: 'a',
        start: async () => undefined,
        stop: async () => {
          stopCalls.push('a');
          throw new Error('stop failed');
        },
      }),
      createModule({
        id: 'b',
        dependencies: ['a'],
        start: async () => undefined,
        stop: async () => {
          stopCalls.push('b');
        },
      }),
    ]);

    await manager.start();

    await expect(manager.stop()).rejects.toMatchObject({
      code: MM_STOP_FAILED,
    });

    expect(stopCalls).toEqual(['b', 'a']);
  });

  it('supports start → stop → start and does not re-run register', async () => {
    const registerMock = jest.fn((_ctx: RuntimeContext) => undefined);
    const startMock = jest.fn(async () => undefined);
    const stopMock = jest.fn(async () => undefined);

    const manager = new ModuleManager({ logger: createSilentLogger() });

    manager.register(
      createModule({
        id: 'a',
        register: registerMock,
        start: startMock,
        stop: stopMock,
      }),
    );

    await manager.start();
    await manager.stop();
    await manager.start();

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledTimes(2);
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('stop is idempotent', async () => {
    manager.register(
      createModule({
        id: 'a',
        start: async () => undefined,
        stop: async () => undefined,
      }),
    );

    await manager.start();

    await expect(manager.stop()).resolves.toBeUndefined();
    await expect(manager.stop()).resolves.toBeUndefined();
  });

  it('does not allow register while started', async () => {
    manager.register(
      createModule({
        id: 'a',
        start: async () => undefined,
        stop: async () => undefined,
      }),
    );

    await manager.start();

    expect(() => manager.register(createModule({ id: 'b', start: async () => undefined }))).toThrow(expect.objectContaining({ code: MM_ALREADY_STARTED }));

    await manager.stop();
  });
  it('does not leak bindings across instances (container isolation)', async () => {
    const TEST_ID = Symbol.for('TEST.RUNTIME.ISOLATION');

    const m1 = new ModuleManager({
      logger: createSilentLogger(),
      container: new Container({ defaultScope: 'Singleton' }),
    });

    const m2 = new ModuleManager({
      logger: createSilentLogger(),
      container: new Container({ defaultScope: 'Singleton' }),
    });

    m1.register(
      createModule({
        id: 'a',
        register: ({ container }) => {
          container.bind(TEST_ID).toConstantValue('one');
        },
        start: async () => undefined,
      }),
    );

    m2.register(
      createModule({
        id: 'a',
        register: ({ container }) => {
          container.bind(TEST_ID).toConstantValue('two');
        },
        start: async () => undefined,
      }),
    );

    await m1.start();
    await m2.start();

    expect(m1.context.container.get(TEST_ID)).toBe('one');
    expect(m2.context.container.get(TEST_ID)).toBe('two');
  });
});
