import type { Address } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import { injectable } from 'inversify';
import { combineLatest, type Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { currentAccountObservable } from '../Plugins/ReactInject/data/useCurrentAccount';
import { currentAddressObservable } from '../Plugins/ReactInject/data/useCurrentAddress';
import { currentNetworkObservable } from '../Plugins/ReactInject/data/useCurrentNetwork';
import {
  type AllEventTypes,
  CURRENT_ACCOUNT_CHANGED_EVENT,
  CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT,
  CURRENT_NETWORK_CHANGED_EVENT,
  type EventBus,
  type EventObject,
  type GetPayload,
} from './eventTypes';

@injectable()
export class EventBusServer implements EventBus {
  private eventSubject = new Subject<EventObject>();

  public dispatch<T extends AllEventTypes>(
    ...args: GetPayload<T> extends undefined ? [type: T, payload?: GetPayload<T>] : [type: T, payload: GetPayload<T>]
  ): void {
    const [type, payload] = args;
    this.eventSubject.next({ type, payload } as EventObject);
  }

  public on<T extends AllEventTypes>(type: T): Observable<GetPayload<T>> {
    return this.eventSubject.asObservable().pipe(
      filter((event): event is Extract<EventObject, { type: T }> => event.type === type),

      map((event) => event.payload as GetPayload<T>),
    );
  }

  public initializeSubscriptions = () => {
    currentAccountObservable.subscribe((account) => {
      this.dispatch(CURRENT_ACCOUNT_CHANGED_EVENT, account);
    });

    currentNetworkObservable.pipe(filter((net) => !!net)).subscribe((network) => {
      this.dispatch(CURRENT_NETWORK_CHANGED_EVENT, network);
    });

    combineLatest([currentNetworkObservable.pipe(filter((net) => !!net)), currentAddressObservable.pipe(filter((addr) => !!addr))])
      .pipe(
        debounceTime(25),
        distinctUntilChanged(([prevNetwork, prevAddress]: [Network, Address], [currentNetwork, currentAddress]: [Network, Address]) => {
          return prevNetwork.id === currentNetwork.id && prevAddress.id === currentAddress.id;
        }),
        map(([network, address]) => ({ network, address })),
      )
      .subscribe((payload) => {
        this.dispatch(CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT, payload);
      });
  };
}
