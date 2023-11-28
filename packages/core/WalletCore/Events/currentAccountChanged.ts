import { Subject } from 'rxjs';
import { type Account } from '../../database/models/Account';
import { currentAccountObservable } from '../Plugins/ReactInject/data/useCurrentAccount';

export const currentAccountChangedSubject = new Subject<Account | null>();
currentAccountObservable.subscribe(currentAccountChangedSubject);