import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { catchError, filter, of, switchMap } from 'rxjs';
import { currentNetworkObservable } from './useCurrentNetwork';

export const currentHdPathObservable = currentNetworkObservable.pipe(
  filter((network) => !!network),
  switchMap((network) => network!.hdPath.observe().pipe(catchError(() => of(null)))),
);
export const currentHdPathAtom = atomWithObservable(() => currentHdPathObservable, { initialValue: null });
export const useCurrentHdPath = () => useAtomValue(currentHdPathAtom);
