import { Subject } from 'rxjs';
import { type Network } from '../../database/models/Network';
import { currentNetworkObservable } from '../Plugins/ReactInject/data/useCurrentNetwork';

export const networkChangedSubject = new Subject<Network | null>();
currentNetworkObservable.subscribe(networkChangedSubject);
