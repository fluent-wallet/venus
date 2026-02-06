import 'reflect-metadata';

import { createPassthroughTestCryptoTool, createSilentLogger } from '@core/__tests__/mocks';
import { CORE_IDENTIFIERS } from '@core/di';
import { ModuleManager } from '@core/runtime/ModuleManager';

import { Container } from 'inversify';
import { createCryptoToolModule } from './CryptoToolModule';

describe('CryptoToolModule', () => {
  it('binds provided cryptoTool into runtime container', async () => {
    const cryptoTool = createPassthroughTestCryptoTool();
    const container = new Container({ defaultScope: 'Singleton' });

    const manager = new ModuleManager({ logger: createSilentLogger(), container });
    manager.register(createCryptoToolModule({ cryptoTool }));

    await manager.start();

    expect(container.get(CORE_IDENTIFIERS.CRYPTO_TOOL)).toBe(cryptoTool);

    await manager.stop();
  });

  it('does not override existing CRYPTO_TOOL binding (supports test doubles)', async () => {
    const existing = createPassthroughTestCryptoTool();
    const cryptoTool = createPassthroughTestCryptoTool();
    const container = new Container({ defaultScope: 'Singleton' });

    container.bind(CORE_IDENTIFIERS.CRYPTO_TOOL).toConstantValue(existing);

    const manager = new ModuleManager({ logger: createSilentLogger(), container });
    manager.register(createCryptoToolModule({ cryptoTool }));

    await manager.start();

    expect(container.get(CORE_IDENTIFIERS.CRYPTO_TOOL)).toBe(existing);

    await manager.stop();
  });
});
