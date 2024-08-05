import events from '@core/WalletCore/Events';
import { type Subscription, catchError, debounceTime, interval, retry, startWith, switchMap, throwError } from 'rxjs';
import type { Plugin } from '../';
import Transaction from '../Transaction';
import type { Address } from '@core/database/models/Address';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    NextNonceTracker: NextNonceTracker;
  }
}

class NextNonceTracker implements Plugin {
  public name = 'NextNonceTracker';
  private _address: Address | null = null;
  private _nextNonce: string | null = null;
  private _pollingSub: Subscription | null = null;

  constructor() {
    this._setup();
  }

  private _setup() {
    events.currentAddressObservable.pipe(debounceTime(40)).subscribe((currentAddress) => {
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
            events.nextNonceSubjectPush.next(res);
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
      events.nextNonceSubjectPush.next(nextNonce);
    }
    return nextNonce;
  }
}

export default new NextNonceTracker();
