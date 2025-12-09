import type { Account } from '@core/database/models/Account';
import type { Address } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import type { Observable } from 'rxjs';
import type { TransactionSubjectValue } from './broadcastTransactionSubject';

export const BROADCAST_TRANSACTION_EVENT = 'core/broadcast-transaction';

export const CURRENT_ACCOUNT_CHANGED_EVENT = 'core/current-account-changed';
export const CURRENT_NETWORK_CHANGED_EVENT = 'core/current-network-changed';
export const CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT = 'core/current-network-and-address-changed';

export interface EventMap {
  [BROADCAST_TRANSACTION_EVENT]: TransactionSubjectValue;
  [CURRENT_ACCOUNT_CHANGED_EVENT]: Account;
  [CURRENT_NETWORK_CHANGED_EVENT]: Network;
  [CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT]: { network: Network; address: Address };
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
