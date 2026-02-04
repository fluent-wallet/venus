import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
import { EXTREQ_REQUEST_CANCELED, EXTREQ_REQUEST_TIMEOUT } from '@core/errors';
import type { RuntimeScheduler } from '@core/runtime/types';
import { type CoreEventMap, InMemoryEventBus } from '../eventBus';
import { ExternalRequestsService } from './ExternalRequestsService';
import type { ExternalRequestSnapshot } from './types';

const createScheduler = (): RuntimeScheduler => {
  return {
    setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
    clearInterval: (id) => clearInterval(id),
  };
};

const makeSnapshot = (tag: string): ExternalRequestSnapshot => {
  return {
    provider: 'wallet-connect',
    kind: 'session_request',
    sessionId: `s_${tag}`,
    origin: `https://dapp.${tag}.example`,
    chainId: 'eip155:1',
    method: 'personal_sign',
    params: ['0xdeadbeef'],
  };
};

describe('ExternalRequestsService', () => {
  it('emits requested only when a request becomes active and advances FIFO', async () => {
    const logger = createSilentLogger();
    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger, assertSerializable: true });

    const now = 1_700_000_000_000;

    const service = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => now,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    try {
      const requested: CoreEventMap['external-requests/requested'][] = [];
      eventBus.on('external-requests/requested', (payload) => {
        requested.push(payload);
      });

      const onApprove1 = jest.fn();
      const onReject1 = jest.fn();
      const onApprove2 = jest.fn();
      const onReject2 = jest.fn();

      const id1 = service.request({ key: 'k1', request: makeSnapshot('1'), handlers: { onApprove: onApprove1, onReject: onReject1 } });
      const id2 = service.request({ key: 'k1', request: makeSnapshot('2'), handlers: { onApprove: onApprove2, onReject: onReject2 } });

      expect(id1).toBe(`req_${now.toString(36)}_1`);
      expect(id2).toBe(`req_${now.toString(36)}_2`);

      expect(requested).toHaveLength(1);
      expect(requested[0].requestId).toBe(id1);

      service.approve({ requestId: id1 });
      expect(onApprove1).toHaveBeenCalledTimes(1);

      expect(requested).toHaveLength(2);
      expect(requested[1].requestId).toBe(id2);

      service.reject({ requestId: id2, error: new Error('no') });
      expect(onReject2).toHaveBeenCalledTimes(1);
    } finally {
      service.stop();
    }
  });

  it('times out via sweep and then activates next request', async () => {
    jest.useFakeTimers();

    const logger = createSilentLogger();
    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger });

    let now = 1_700_000_000_000;

    const service = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => now,
      logger,
      defaultTtlMs: 50,
      sweepIntervalMs: 10,
      maxActiveRequests: 1,
    });

    service.start();

    try {
      const requested: CoreEventMap['external-requests/requested'][] = [];
      eventBus.on('external-requests/requested', (payload) => {
        requested.push(payload);
      });

      const onApprove1 = jest.fn();
      const onReject1 = jest.fn();
      const onApprove2 = jest.fn();
      const onReject2 = jest.fn();

      const id1 = service.request({ key: 'k1', request: makeSnapshot('1'), handlers: { onApprove: onApprove1, onReject: onReject1 }, ttlMs: 50 });
      const id2 = service.request({ key: 'k1', request: makeSnapshot('2'), handlers: { onApprove: onApprove2, onReject: onReject2 }, ttlMs: 500 });

      expect(requested).toHaveLength(1);
      expect(requested[0].requestId).toBe(id1);

      now += 60;
      jest.advanceTimersByTime(60);

      expect(onReject1).toHaveBeenCalledTimes(1);
      expect(onReject1.mock.calls[0]?.[0]).toMatchObject({ code: EXTREQ_REQUEST_TIMEOUT });

      expect(requested).toHaveLength(2);
      expect(requested[1].requestId).toBe(id2);
    } finally {
      service.stop();
      jest.useRealTimers();
    }
  });

  it('stop() rejects active + queued with EXTREQ_REQUEST_CANCELED and does not emit further', async () => {
    jest.useFakeTimers();

    const logger = createSilentLogger();
    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger });

    const service = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10,
      maxActiveRequests: 1,
    });

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => {
      requested.push(payload);
    });

    const onReject1 = jest.fn();
    const onReject2 = jest.fn();

    service.request({ key: 'k1', request: makeSnapshot('1'), handlers: { onApprove: jest.fn(), onReject: onReject1 } });
    service.request({ key: 'k1', request: makeSnapshot('2'), handlers: { onApprove: jest.fn(), onReject: onReject2 } });

    expect(requested).toHaveLength(1);

    service.stop();

    expect(onReject1).toHaveBeenCalledTimes(1);
    expect(onReject1.mock.calls[0]?.[0]).toMatchObject({ code: EXTREQ_REQUEST_CANCELED });

    expect(onReject2).toHaveBeenCalledTimes(1);
    expect(onReject2.mock.calls[0]?.[0]).toMatchObject({ code: EXTREQ_REQUEST_CANCELED });

    jest.advanceTimersByTime(10_000);
    expect(requested).toHaveLength(1);

    jest.useRealTimers();
  });

  it('supports cross-key concurrency with maxActiveRequests=2 and keeps same-key serial', async () => {
    const logger = createSilentLogger();
    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger });

    const now = 1_700_000_000_000;

    const service = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => now,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 2,
    });

    service.start();

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const onReject = jest.fn();

    service.request({ key: 'A', request: makeSnapshot('a1'), handlers: { onApprove: jest.fn(), onReject } });
    service.request({ key: 'A', request: makeSnapshot('a2'), handlers: { onApprove: jest.fn(), onReject } });
    service.request({ key: 'B', request: makeSnapshot('b1'), handlers: { onApprove: jest.fn(), onReject } });

    // active should include at most 2, and not both from key A
    expect(requested).toHaveLength(2);

    const aCount = requested.filter(
      ({ request }) => request.kind === 'session_request' && (request.sessionId === 's_a1' || request.sessionId === 's_a2'),
    ).length;
    expect(aCount).toBe(1);

    service.stop();
  });
});
