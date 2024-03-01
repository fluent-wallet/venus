import { injectable } from 'inversify';
import { combineLatest, filter, debounceTime, distinctUntilChanged } from 'rxjs';
import { container } from '../configs';
import { lifecycleChangedSubject } from './lifecycleChanged';
import { currentAccountChangedSubject, currentAccountObservable } from './currentAccountChanged';
import { currentAddressChangedSubject, currentAddressObservable } from './currentAddressChanged';
import { currentNetworkChangedSubject, currentNetworkObservable } from './currentNetworkChanged';
import { networksChangedSubject } from './networksChanged';
import { newestRequestSubject } from './requestSubject';
import { broadcastTransactionSubjectPush, broadcastTransactionSubject } from './broadcastTransactionSubject';
import { type Address } from '../../database/models/Address';
import { type Network } from '../../database/models/Network';

const compareNetworkAndAddress = ([prevNetwork, prevAddress]: [Network, Address], [currentNetwork, currentAddress]: [Network, Address]) => {
  return prevNetwork.id === currentNetwork.id && prevAddress.id === currentAddress.id;
};

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
  public broadcastTransactionSubjectPush = broadcastTransactionSubjectPush;
  public broadcastTransactionSubject = broadcastTransactionSubject;
  public newestRequestSubject = newestRequestSubject;
  public combineNetworkAndAddressChangedSubject = combineLatest([this.currentNetworkObservable, this.currentAddressObservable]).pipe(
    filter((tuple): tuple is [Network, Address] => tuple.every((ele) => !!ele)),
    debounceTime(25),
    distinctUntilChanged(compareNetworkAndAddress),
  );
}

container.bind(Events).to(Events).inSingletonScope();
export default container.get(Events) as Events;
