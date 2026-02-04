import type { Address } from '@core/database/models/Address';
import type { EventBus } from '@core/WalletCore/Events';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { inject, injectable } from 'inversify';
import { catchError, debounceTime, interval, retry, type Subscription, startWith, switchMap, throwError } from 'rxjs';
import { currentAddressObservable } from '../ReactInject/data/useCurrentAddress';
import Transaction from '../Transaction';

export const NEXT_NONCE_TRACKER_EVENT = 'NextNonceTracker';

declare module '../../Events/eventTypes.ts' {
  interface EventMap {
    [NEXT_NONCE_TRACKER_EVENT]: string;
  }
}

export interface INextNonceTrackerServerInterface {
  getNextNonce(address: Address, forceUpdate?: boolean): Promise<string>;
}

@injectable()
export class NextNonceTrackerServer {
  public name = 'NextNonceTracker';
  private _address: Address | null = null;
  private _nextNonce: string | null = null;
  private _pollingSub: Subscription | null = null;

  @inject(SERVICE_IDENTIFIER.EVENT_BUS)
  eventBus!: EventBus;

  _setup() {
    currentAddressObservable.pipe(debounceTime(40)).subscribe((currentAddress) => {
      this._address = currentAddress;
      this._nextNonce = null;
      this._startup(currentAddress);
    });
  }

  private _startup(address: Address | null) {
    this._pollingSub?.unsubscribe();
    if (address) {
      this._pollingSub = interval(10000)
        .pipe(
          startWith(0),
          switchMap(() => Promise.all([address.getValue(), address.network])),
          switchMap(([addressValue, network]) =>
            Transaction.getTransactionCount({
              network,
              addressValue,
            }),
          ),
          catchError((err: { code: string; message: string }) => {
            console.error('get next nonce error: ', err);
            return throwError(() => err);
          }),
          retry({ delay: 1000 }),
        )
        .subscribe((res) => {
          if (this._nextNonce === null || BigInt(this._nextNonce) < BigInt(res)) {
            this._nextNonce = res;
            this.eventBus.dispatch(NEXT_NONCE_TRACKER_EVENT, res);
          }
        });
    }
  }

  public async getNextNonce(address: Address, forceUpdate = false): Promise<string> {
    if (this._address?.id === address.id && this._nextNonce && !forceUpdate) {
      return this._nextNonce;
    }
    const [addressValue, network] = await Promise.all([address.getValue(), address.network]);
    const nextNonce = await Transaction.getTransactionCount({
      network,
      addressValue,
    });
    if (this._address?.id === address.id && (this._nextNonce === null || BigInt(this._nextNonce) < BigInt(nextNonce))) {
      this._nextNonce = nextNonce;

      this.eventBus.dispatch(NEXT_NONCE_TRACKER_EVENT, nextNonce);
    }
    return nextNonce;
  }
}
