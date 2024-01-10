import { startWith, pairwise, map, Subject } from 'rxjs';
import { differenceWith, isEqual } from 'lodash-es';
import { type Network } from '../../database/models/Network';
import { networksObservable } from '../Plugins/ReactInject/data/useNetworks';

export const networksChangedSubject = new Subject<{ added: Array<Network>; removed: Array<Network> }>();
const networksChangedObservable = networksObservable.pipe(
  startWith([]),
  pairwise(),
  map(([oldResult, newResult]) => {
    const added = differenceWith(newResult, oldResult, isEqual);
    const removed = differenceWith(oldResult, newResult, isEqual);

    return { added, removed, now: newResult };
  }),
);
networksChangedObservable.subscribe(networksChangedSubject);
