import { Subject } from 'rxjs';
import { type Network } from '../../database/models/Network';
import { currentNetworkObservable } from '../Plugins/ReactInject/data/useCurrentNetwork';

export const currentNetworkChangedSubject = new Subject<Network | null>();
currentNetworkObservable.subscribe(currentNetworkChangedSubject);
