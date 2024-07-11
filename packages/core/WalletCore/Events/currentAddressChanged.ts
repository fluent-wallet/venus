import { Subject } from 'rxjs';
import type { Address } from '../../database/models/Address';
import { currentAddressObservable } from '../Plugins/ReactInject/data/useCurrentAddress';

export { currentAddressObservable };
export const currentAddressChangedSubject = new Subject<Address | null>();
currentAddressObservable.subscribe(currentAddressChangedSubject);
