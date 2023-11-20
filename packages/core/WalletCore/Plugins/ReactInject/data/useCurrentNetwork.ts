import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { map } from 'rxjs';
import { networksObservable } from './useNetworks';

export const currentNetworkObservable = networksObservable.pipe(map((networks) => networks.find((network) => network.selected) ?? null));
export const currentNetworkAtom = atomWithObservable(() => currentNetworkObservable, { initialValue: null });
export const useCurrentNetwork = () => useAtomValue(currentNetworkAtom);
