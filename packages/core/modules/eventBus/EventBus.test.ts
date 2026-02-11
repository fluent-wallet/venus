import 'reflect-metadata';

import { createSilentLogger } from '@core/testUtils/mocks';
import { EVENT_PAYLOAD_NOT_SERIALIZABLE } from '@core/errors';
import { InMemoryEventBus } from './EventBus';
import type { EventBus } from './types';

describe('InMemoryEventBus', () => {
  it('delivers payload to subscribed handlers', () => {
    type TestEventMap = {
      'test/event': { value: string } | null;
    };

    const bus: EventBus<TestEventMap> = new InMemoryEventBus<TestEventMap>({ logger: createSilentLogger() });

    const calls: Array<TestEventMap['test/event']> = [];

    bus.on('test/event', (payload) => {
      calls.push(payload);
    });

    bus.emit('test/event', { value: 'ok' });

    expect(calls).toEqual([{ value: 'ok' }]);
  });

  it('supports unsubscribe()', () => {
    type TestEventMap = {
      'test/event': { value: string } | null;
    };

    const bus: EventBus<TestEventMap> = new InMemoryEventBus<TestEventMap>({ logger: createSilentLogger() });

    const calls: string[] = [];

    const sub = bus.on('test/event', (payload) => {
      if (payload) calls.push(payload.value);
    });

    bus.emit('test/event', { value: 'one' });
    sub.unsubscribe();
    bus.emit('test/event', { value: 'two' });

    expect(calls).toEqual(['one']);
  });

  it('throws EVENT_PAYLOAD_NOT_SERIALIZABLE when assertSerializable=true and payload is not JSON', () => {
    type TestEventMap = {
      'test/event': any;
    };

    const bus = new InMemoryEventBus<TestEventMap>({
      logger: createSilentLogger(),
      assertSerializable: true,
    });

    expect(() => bus.emit('test/event', { now: new Date() } as unknown)).toThrow(expect.objectContaining({ code: EVENT_PAYLOAD_NOT_SERIALIZABLE }));
  });

  it('fail-fast when strictEmit=true and handler throws', () => {
    type TestEventMap = {
      'test/event': { value: string } | null;
    };

    const bus: EventBus<TestEventMap> = new InMemoryEventBus<TestEventMap>({
      logger: createSilentLogger(),
      strictEmit: true,
    });

    const calls: string[] = [];

    bus.on('test/event', () => {
      calls.push('first');
      throw new Error('boom');
    });

    bus.on('test/event', () => {
      calls.push('second');
    });

    expect(() => bus.emit('test/event', { value: 'x' })).toThrow('boom');
    expect(calls).toEqual(['first']);
  });

  it('continues when strictEmit=false and handler throws', () => {
    type TestEventMap = {
      'test/event': { value: string } | null;
    };

    const bus: EventBus<TestEventMap> = new InMemoryEventBus<TestEventMap>({
      logger: createSilentLogger(),
      strictEmit: false,
    });

    const calls: string[] = [];

    bus.on('test/event', () => {
      calls.push('first');
      throw new Error('boom');
    });

    bus.on('test/event', () => {
      calls.push('second');
    });

    expect(() => bus.emit('test/event', { value: 'x' })).not.toThrow();
    expect(calls).toEqual(['first', 'second']);
  });

  it('supports signal events via emit(event) and normalizes payload to null', () => {
    type TestEventMap = {
      'test/signal': null;
    };

    const bus: EventBus<TestEventMap> = new InMemoryEventBus<TestEventMap>({
      logger: createSilentLogger(),
    });

    const calls: Array<TestEventMap['test/signal']> = [];

    bus.on('test/signal', (payload) => {
      calls.push(payload);
    });

    bus.emit('test/signal');

    expect(calls).toEqual([null]);
  });
});
