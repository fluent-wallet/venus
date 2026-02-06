import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
import { AUTH_PASSWORD_REQUEST_CANCELED, AUTH_PASSWORD_REQUEST_TIMEOUT } from '@core/errors';
import type { RuntimeScheduler } from '@core/runtime/types';
import { type CoreEventMap, InMemoryEventBus } from '../eventBus';
import { AuthService } from './AuthService';
import { AUTH_REASON } from './reasons';

const createScheduler = (): RuntimeScheduler => {
  return {
    setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
    clearInterval: (id) => clearInterval(id),
  };
};

describe('AuthService', () => {
  it('queues requests and only activates one at a time', async () => {
    const now = 1_700_000_000_000;

    const logger = createSilentLogger();
    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger, assertSerializable: true });

    const auth = new AuthService({
      eventBus,
      scheduler: createScheduler(),
      now: () => now,
      logger,
      defaultTimeoutMs: 10_000,
    });

    const requested: CoreEventMap['auth/credential-requested'][] = [];
    eventBus.on('auth/credential-requested', (payload) => {
      requested.push(payload);
    });

    const p1 = auth.getPassword({ reason: AUTH_REASON.SIGN_TX });
    const p2 = auth.getPassword({ reason: AUTH_REASON.SIGN_PERSONAL_MESSAGE });

    expect(requested).toHaveLength(1);
    expect(requested[0].requestId).toBe(`auth_${now.toString(36)}_1`);
    expect(requested[0].kind).toBe('password');

    auth.resolvePassword({ requestId: requested[0].requestId, password: 'one' });
    await expect(p1).resolves.toBe('one');

    expect(requested).toHaveLength(2);
    expect(requested[1].requestId).toBe(`auth_${now.toString(36)}_2`);
    expect(requested[1].kind).toBe('password');

    auth.resolvePassword({ requestId: requested[1].requestId, password: 'two' });
    await expect(p2).resolves.toBe('two');
  });
  it('rejects with AUTH_PASSWORD_REQUEST_CANCELED when canceled (active)', async () => {
    const logger = createSilentLogger();
    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger });

    const auth = new AuthService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTimeoutMs: 10_000,
    });

    let requestId = '';
    eventBus.on('auth/credential-requested', (payload) => {
      requestId = payload.requestId;
    });

    const p = auth.getPassword();
    expect(requestId).not.toBe('');

    auth.cancelPasswordRequest({ requestId });

    await expect(p).rejects.toMatchObject({ code: AUTH_PASSWORD_REQUEST_CANCELED });
  });

  it('rejects with AUTH_PASSWORD_REQUEST_TIMEOUT when timed out and then activates next queued request', async () => {
    jest.useFakeTimers();

    const logger = createSilentLogger();
    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger });

    const auth = new AuthService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTimeoutMs: 50,
    });

    const requested: CoreEventMap['auth/credential-requested'][] = [];
    eventBus.on('auth/credential-requested', (payload) => {
      requested.push(payload);
    });

    const p1 = auth.getPassword({ timeoutMs: 50 });
    const p2 = auth.getPassword({ timeoutMs: 50 });

    expect(requested).toHaveLength(1);

    jest.advanceTimersByTime(60);

    await expect(p1).rejects.toMatchObject({ code: AUTH_PASSWORD_REQUEST_TIMEOUT });

    expect(requested).toHaveLength(2);

    auth.cancelPasswordRequest({ requestId: requested[1].requestId });
    await expect(p2).rejects.toMatchObject({ code: AUTH_PASSWORD_REQUEST_CANCELED });

    jest.useRealTimers();
  });

  it('stop() rejects active + queued and does not emit further requests', async () => {
    jest.useFakeTimers();

    const logger = createSilentLogger();
    const eventBus = new InMemoryEventBus<CoreEventMap>({ logger });

    const auth = new AuthService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTimeoutMs: 50,
    });

    const requested: CoreEventMap['auth/credential-requested'][] = [];
    eventBus.on('auth/credential-requested', (payload) => {
      requested.push(payload);
    });

    const p1 = auth.getPassword({ timeoutMs: 50 });
    const p2 = auth.getPassword({ timeoutMs: 50 });

    expect(requested).toHaveLength(1);

    auth.stop();

    await expect(p1).rejects.toMatchObject({ code: AUTH_PASSWORD_REQUEST_CANCELED });
    await expect(p2).rejects.toMatchObject({ code: AUTH_PASSWORD_REQUEST_CANCELED });

    jest.advanceTimersByTime(10_000);
    expect(requested).toHaveLength(1);

    jest.useRealTimers();
  });
});
