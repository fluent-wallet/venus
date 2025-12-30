import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
import { CORE_IDENTIFIERS } from '@core/di';
import { ModuleManager } from '@core/runtime/ModuleManager';
import type { RuntimeScheduler } from '@core/runtime/types';
import { Container } from 'inversify';
import { type CoreEventMap, type EventBus, EventBusModule } from '../eventBus';
import { ExternalRequestsModule } from './ExternalRequestsModule';
import { ExternalRequestsService } from './ExternalRequestsService';
import type { ExternalRequestSnapshot } from './types';

const makeSnapshot = (tag: string): ExternalRequestSnapshot => {
  return {
    provider: 'wallet-connect',
    kind: 'session_request',
    sessionId: `s_${tag}`,
    origin: 'https://dapp.example',
    chainId: 'eip155:1',
    method: 'personal_sign',
    params: ['0xdeadbeef'],
  };
};

describe('ExternalRequestsModule', () => {
  it('binds ExternalRequestsService into runtime container', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        externalRequests: { requestTtlMs: 10_000, sweepIntervalMs: 10_000 },
      },
    });

    manager.register([EventBusModule, ExternalRequestsModule]);
    await manager.start();

    const service = container.get<ExternalRequestsService>(CORE_IDENTIFIERS.EXTERNAL_REQUESTS);
    expect(service).toBeInstanceOf(ExternalRequestsService);

    await manager.stop();
  });

  it('uses walletConnect.maxActiveRequests as fallback', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        walletConnect: { maxActiveRequests: 2 },
      },
    });

    manager.register([EventBusModule, ExternalRequestsModule]);
    await manager.start();

    try {
      const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
      const service = container.get<ExternalRequestsService>(CORE_IDENTIFIERS.EXTERNAL_REQUESTS);

      const requested: CoreEventMap['external-requests/requested'][] = [];
      eventBus.on('external-requests/requested', (payload) => requested.push(payload));

      service.request({ key: 'k1', request: makeSnapshot('1'), handlers: { onApprove: jest.fn(), onReject: jest.fn() } });
      service.request({ key: 'k2', request: makeSnapshot('2'), handlers: { onApprove: jest.fn(), onReject: jest.fn() } });
      service.request({ key: 'k3', request: makeSnapshot('3'), handlers: { onApprove: jest.fn(), onReject: jest.fn() } });

      expect(requested).toHaveLength(2);
    } finally {
      await manager.stop();
    }
  });

  it('prefers externalRequests.maxActiveRequests over walletConnect.maxActiveRequests', async () => {
    const container = new Container({ defaultScope: 'Singleton' });
    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        externalRequests: { maxActiveRequests: 1 },
        walletConnect: { maxActiveRequests: 2 },
      },
    });

    manager.register([EventBusModule, ExternalRequestsModule]);
    await manager.start();

    try {
      const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
      const service = container.get<ExternalRequestsService>(CORE_IDENTIFIERS.EXTERNAL_REQUESTS);

      const requested: CoreEventMap['external-requests/requested'][] = [];
      eventBus.on('external-requests/requested', (payload) => requested.push(payload));

      service.request({ key: 'k1', request: makeSnapshot('1'), handlers: { onApprove: jest.fn(), onReject: jest.fn() } });
      service.request({ key: 'k2', request: makeSnapshot('2'), handlers: { onApprove: jest.fn(), onReject: jest.fn() } });
      service.request({ key: 'k3', request: makeSnapshot('3'), handlers: { onApprove: jest.fn(), onReject: jest.fn() } });

      expect(requested).toHaveLength(1);
    } finally {
      await manager.stop();
    }
  });
  it('clears sweep interval on stop', async () => {
    jest.useFakeTimers();

    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');

    const scheduler: RuntimeScheduler = {
      setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
      clearTimeout: (id) => clearTimeout(id),
      setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
      clearInterval: (id) => clearInterval(id),
    };

    const container = new Container({ defaultScope: 'Singleton' });
    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      scheduler,
      config: {
        externalRequests: { requestTtlMs: 10_000, sweepIntervalMs: 10 },
      },
    });

    manager.register([EventBusModule, ExternalRequestsModule]);
    await manager.start();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    await manager.stop();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  });
});
