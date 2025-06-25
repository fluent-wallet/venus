import type { Observable } from 'rxjs';
import type { TransactionSubjectValue } from './broadcastTransactionSubject';

export const EVENT_BUS = 'core/event-bus';
export const BROADCAST_TRANSACTION = 'core/broadcast-transaction';

export interface EventMap {
  'core/event-bus': undefined;
  [BROADCAST_TRANSACTION]: TransactionSubjectValue;
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
