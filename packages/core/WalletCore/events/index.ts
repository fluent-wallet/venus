import { injectable } from 'inversify';
import { container } from '../configs';
import { lifecycleChangedSubject } from './lifecycleChanged';
import { currentAccountChangedSubject } from './currentAccountChanged';
import { currentAddressChangedSubject } from './currentAddressChanged';
import { currentNetworkChangedSubject } from './currentNetworkChanged';
import { networksChangedSubject } from './networksChanged';

export interface Event {
  name: string;
}

@injectable()
export class Events {
  public lifecycleChangedSubject = lifecycleChangedSubject;
  public currentAccountChangedSubject = currentAccountChangedSubject;
  public currentAddressChangedSubject = currentAddressChangedSubject;
  public currentNetworkChangedSubject = currentNetworkChangedSubject;
  public networksChangedSubject = networksChangedSubject;
}

container.bind(Events).to(Events).inSingletonScope();
export default container.get(Events) as Events;
