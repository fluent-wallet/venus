import { from, map, of, Subject, switchMap } from 'rxjs';
import { currentAddressObservable } from '../../../Plugins/ReactInject/data/useCurrentAddress';

const accountsChangedObservable = currentAddressObservable.pipe(
  switchMap((address) => (address ? from(address.getValue()) : of(null))),
  map((addressStr) => (addressStr ? [addressStr] : [])),
);
export const accountsChangedSubject = new Subject<Array<string>>();
accountsChangedObservable.subscribe(accountsChangedSubject);
