import type { Observable } from 'rxjs';

export interface EventMap {
  'core/event-bus': undefined;
}

export type AllEventTypes = keyof EventMap;

export type GetPayload<TType extends AllEventTypes> = EventMap[TType];

export type EventObject<TType extends AllEventTypes = AllEventTypes> = {
  [K in TType]: {
    type: K;
    payload: GetPayload<K>;
  };
}[TType];
export interface EventBus {
  dispatch<T extends AllEventTypes>(...args: GetPayload<T> extends undefined ? [type: T, payload?: GetPayload<T>] : [type: T, payload: GetPayload<T>]): void;
  on<T extends AllEventTypes>(type: T): Observable<GetPayload<T>>;
}
