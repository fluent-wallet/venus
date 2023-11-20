import { Subject } from 'rxjs';
import { type Address } from '../../database/models/Address';
import { currentAddressObservable } from '../Plugins/ReactInject/data/useCurrentAddress';

export const addressChangedSubject = new Subject<Address | null>();
currentAddressObservable.subscribe(addressChangedSubject);
