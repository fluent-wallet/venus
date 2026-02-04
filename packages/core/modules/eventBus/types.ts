export interface Subscription {
  unsubscribe(): void;
}

type KeysWithNullPayload<EventMap extends Record<string, unknown>> = {
  [K in keyof EventMap]-?: null extends EventMap[K] ? K : never;
}[keyof EventMap];

export interface EventBus<EventMap extends Record<string, unknown>> {
  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): Subscription;

  emit<K extends KeysWithNullPayload<EventMap>>(event: K): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
}
