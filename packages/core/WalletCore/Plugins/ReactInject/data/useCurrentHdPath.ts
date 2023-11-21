import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, of } from 'rxjs';
import { currentNetworkObservable } from './useCurrentNetwork';

export const currentHdPathObservable = currentNetworkObservable.pipe(switchMap((network) => (network ? network.hdPath.observe() : of(null))));
export const currentHdPathAtom = atomWithObservable(() => currentHdPathObservable, { initialValue: null });
export const useCurrentHdPath = () => useAtomValue(currentHdPathAtom);
