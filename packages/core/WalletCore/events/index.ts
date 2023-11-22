import { injectable } from 'inversify';
import { container } from '../configs';
import { lifecycleChangedSubject } from './lifecycleChanged';
import { currentAccountChangedSubject } from './currentAccountChanged';
import { currentAddressChangedSubject } from './currentAddressChanged';
import { currentNetworkChangedSubject } from './currentNetworkChanged';

export interface Event {
  name: string;
}

@injectable()
export class Events {
  public lifecycleChangedSubject = lifecycleChangedSubject;
  public currentAccountChangedSubject = currentAccountChangedSubject;
  public currentAddressChangedSubject = currentAddressChangedSubject;
  public currentNetworkChangedSubject = currentNetworkChangedSubject;
}

container.bind(Events).to(Events);
export default container.get(Events) as Events;
