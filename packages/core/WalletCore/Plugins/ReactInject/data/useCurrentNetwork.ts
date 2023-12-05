import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, of, startWith } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { querySelectedNetwork } from '../../../../database/models/Network/query';
import { getAtom } from '../nexus';

export const currentNetworkObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => querySelectedNetwork().observe()),
  switchMap((selectedNetworks) => {
    return selectedNetworks?.[0] ? of(selectedNetworks[0]) : of(null);
  })
);

export const currentNetworkAtom = atomWithObservable(() => currentNetworkObservable, { initialValue: null });
export const useCurrentNetwork = () => useAtomValue(currentNetworkAtom);
export const getCurrentNetwork = () => getAtom(currentNetworkAtom);
