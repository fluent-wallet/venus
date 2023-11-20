import { Subject, map } from 'rxjs';
import { currentNetworkObservable } from '../../../Plugins/ReactInject/data/useCurrentNetwork';

const chainChangedObservable = currentNetworkObservable.pipe(map((network) => network?.chainId));
export const chainChangedSubject = new Subject<string | undefined>();
chainChangedObservable.subscribe(chainChangedSubject);
