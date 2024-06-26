import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { memoize } from 'lodash-es';
import { map, of, startWith, switchMap } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { observeNetworkById, querySelectedNetwork } from '../../../../database/models/Network/query';
import { getAtom } from '../nexus';

export const currentNetworkObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => querySelectedNetwork().observe()),
  switchMap((selectedNetworks) => {
    return selectedNetworks?.[0] ? of(selectedNetworks[0]) : of(null);
  }),
);

export const currentNetworkAtom = atomWithObservable(() => currentNetworkObservable, { initialValue: null });
export const useCurrentNetwork = () => useAtomValue(currentNetworkAtom);
export const getCurrentNetwork = () => getAtom(currentNetworkAtom);

export const observeNativeAssetOfNetwork = memoize((networkId: string) =>
  observeNetworkById(networkId).pipe(switchMap((network) => network.nativeAssetQuery.observe())),
);
const nativeAssetAtomFamilyOfNetwork = atomFamily((networkId: string | undefined | null) =>
  atomWithObservable(() => (!networkId ? of([]) : observeNativeAssetOfNetwork(networkId)).pipe(map((nativeAsset) => nativeAsset?.[0] ?? null)), {
    initialValue: null,
  }),
);

export const useCurrentNetworkNativeAsset = () => {
  const currentNetwork = useCurrentNetwork();
  return useAtomValue(nativeAssetAtomFamilyOfNetwork(currentNetwork?.id));
};
export const getCurrentNetworkNativeAsset = () => {
  const currentNetwork = getCurrentNetwork();
  return getAtom(nativeAssetAtomFamilyOfNetwork(currentNetwork?.id));
};
