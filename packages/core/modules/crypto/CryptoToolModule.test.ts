import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
import { CORE_IDENTIFIERS } from '@core/di';
import { ModuleManager } from '@core/runtime/ModuleManager';
import type { CryptoTool } from '@core/types/crypto';
import { Container } from 'inversify';
import { createCryptoToolModule } from './CryptoToolModule';

class FakeCryptoTool implements CryptoTool {
  generateRandomString(_byteCount?: number): string {
    return 'fake';
  }

  async encrypt(data: unknown): Promise<string> {
    return JSON.stringify({ data });
  }

  async decrypt<T = unknown>(encryptedDataString: string): Promise<T> {
    return JSON.parse(encryptedDataString).data as T;
  }
}

describe('CryptoToolModule', () => {
  it('binds provided cryptoTool into runtime container', async () => {
    const cryptoTool = new FakeCryptoTool();
    const container = new Container({ defaultScope: 'Singleton' });

    const manager = new ModuleManager({ logger: createSilentLogger(), container });
    manager.register(createCryptoToolModule({ cryptoTool }));

    await manager.start();

    expect(container.get(CORE_IDENTIFIERS.CRYPTO_TOOL)).toBe(cryptoTool);

    await manager.stop();
  });

  it('does not override existing CRYPTO_TOOL binding (supports test doubles)', async () => {
    const existing = new FakeCryptoTool();
    const cryptoTool = new FakeCryptoTool();
    const container = new Container({ defaultScope: 'Singleton' });

    container.bind(CORE_IDENTIFIERS.CRYPTO_TOOL).toConstantValue(existing);

    const manager = new ModuleManager({ logger: createSilentLogger(), container });
    manager.register(createCryptoToolModule({ cryptoTool }));

    await manager.start();

    expect(container.get(CORE_IDENTIFIERS.CRYPTO_TOOL)).toBe(existing);

    await manager.stop();
  });
});
