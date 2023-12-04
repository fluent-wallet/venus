import { injectable } from 'inversify';
import { container } from '../configs';
import { lifecycleChangedSubject } from './lifecycleChanged';
import { currentAccountChangedSubject, currentAccountObservable } from './currentAccountChanged';
import { currentAddressChangedSubject, currentAddressObservable } from './currentAddressChanged';
import { currentNetworkChangedSubject, currentNetworkObservable } from './currentNetworkChanged';
import { networksChangedSubject } from './networksChanged';

@injectable()
export class Events {
  public lifecycleChangedSubject = lifecycleChangedSubject;
  public currentAccountChangedSubject = currentAccountChangedSubject;
  public currentAccountObservable = currentAccountObservable;
  public currentAddressChangedSubject = currentAddressChangedSubject;
  public currentAddressObservable = currentAddressObservable;
  public currentNetworkChangedSubject = currentNetworkChangedSubject;
  public currentNetworkObservable = currentNetworkObservable;
  public networksChangedSubject = networksChangedSubject;
}

container.bind(Events).to(Events).inSingletonScope();
export default container.get(Events) as Events;
