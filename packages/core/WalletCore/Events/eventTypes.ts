import type { Account } from '@core/database/models/Account';
import type { Address } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import type { HardwareOperationError } from '@core/types';
import type { Observable } from 'rxjs';
import type { TransactionSubjectValue } from './broadcastTransactionSubject';
export const BROADCAST_TRANSACTION_EVENT = 'core/broadcast-transaction';

export const CURRENT_ACCOUNT_CHANGED_EVENT = 'core/current-account-changed';
export const CURRENT_NETWORK_CHANGED_EVENT = 'core/current-network-changed';
export const CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT = 'core/current-network-and-address-changed';

// Hardware events
export const HARDWARE_SIGN_START_EVENT = 'hardware:sign/start';
export const HARDWARE_SIGN_SUCCESS_EVENT = 'hardware:sign/success';
export const HARDWARE_SIGN_ERROR_EVENT = 'hardware:sign/error';
export const HARDWARE_SIGN_ABORT_EVENT = 'hardware:sign/abort';

export interface EventMap {
  [BROADCAST_TRANSACTION_EVENT]: TransactionSubjectValue;
  [CURRENT_ACCOUNT_CHANGED_EVENT]: Account;
  [CURRENT_NETWORK_CHANGED_EVENT]: Network;
  [CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT]: { network: Network; address: Address };

  [HARDWARE_SIGN_START_EVENT]: {
    requestId: string;
    accountId: string;
    addressId: string;
    networkId: string;
    txPayload: unknown;
  };
  [HARDWARE_SIGN_SUCCESS_EVENT]: {
    requestId: string;
    accountId: string;
    addressId: string;
    networkId: string;
    txHash: string;
    rawTransaction?: string;
  };
  [HARDWARE_SIGN_ERROR_EVENT]: {
    requestId: string;
    accountId: string;
    addressId: string;
    networkId: string;
    error: HardwareOperationError;
  };
  [HARDWARE_SIGN_ABORT_EVENT]: {
    requestId: string;
    accountId: string;
    addressId: string;
    networkId: string;
  };
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
