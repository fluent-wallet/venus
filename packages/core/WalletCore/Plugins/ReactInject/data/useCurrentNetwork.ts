import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { map } from 'rxjs';
import { type Network } from '../../../../database/models/Network';
import { querySelectedNetwork } from '../../../../database/models/Network/query';
import { getAtom } from '../nexus';

export const currentNetworkObservable = querySelectedNetwork()
  .observe()
  .pipe(map((networks) => (networks?.[0] as Network | undefined) ?? null));

export const currentNetworkAtom = atomWithObservable(() => currentNetworkObservable, { initialValue: null });
export const useCurrentNetwork = () => useAtomValue(currentNetworkAtom);
export const getCurrentNetwork = () => getAtom(currentNetworkAtom);
