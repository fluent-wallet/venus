import { assertJsonValue, EVENT_PAYLOAD_NOT_SERIALIZABLE } from '@core/errors';
import type { Logger } from '@core/runtime/types';
import type { EventBus, Subscription } from './types';

export type InMemoryEventBusOptions = {
  logger?: Logger;
  strictEmit?: boolean;
  assertSerializable?: boolean;
};

type AnyHandler = (payload: unknown) => void;

export class InMemoryEventBus<EventMap extends Record<string, unknown>> implements EventBus<EventMap> {
  private readonly handlers = new Map<keyof EventMap, Set<AnyHandler>>();
  private readonly logger: Logger | undefined;
  private readonly strictEmit: boolean;
  private readonly assertSerializable: boolean;

  constructor(options: InMemoryEventBusOptions = {}) {
    this.logger = options.logger;
    this.strictEmit = options.strictEmit ?? false;
    this.assertSerializable = options.assertSerializable ?? false;
  }

  public on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): Subscription {
    const existing = this.handlers.get(event);

    let set: Set<AnyHandler>;
    if (existing) {
      set = existing;
    } else {
      set = new Set<AnyHandler>();
      this.handlers.set(event, set);
    }

    set.add(handler as unknown as AnyHandler);

    return {
      unsubscribe: () => {
        const current = this.handlers.get(event);
        if (!current) return;

        current.delete(handler as unknown as AnyHandler);
        if (current.size === 0) this.handlers.delete(event);
      },
    };
  }

  public emit<K extends keyof EventMap>(event: K): void;
  public emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
  public emit<K extends keyof EventMap>(event: K, payload?: EventMap[K]): void {
    const normalizedPayload = (payload ?? null) as EventMap[K];

    if (this.assertSerializable) {
      assertJsonValue(normalizedPayload, {
        code: EVENT_PAYLOAD_NOT_SERIALIZABLE,
        message: 'EventBus payload is not JSON-serializable.',
      });
    }

    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;

    const snapshot = Array.from(set);

    for (const handler of snapshot) {
      try {
        handler(normalizedPayload as unknown);
      } catch (error) {
        this.logger?.error('EventBus:handler-error', { event: String(event), error });

        if (this.strictEmit) {
          throw error;
        }
      }
    }
  }
}
