import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { memoize, pick } from 'lodash-es';
import { map, of, startWith, switchMap, type Observable } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import type { Network } from '../../../../database/models/Network';
import { observeNetworkById, querySelectedNetwork } from '../../../../database/models/Network/query';
import { getAtom } from '../nexus';

const selectedNetworkObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => querySelectedNetwork().observeWithColumns(['endpoint', 'endpoints_list'])),
);

export const currentNetworkObservable = selectedNetworkObservable.pipe(
  switchMap((selectedNetworks) => {
    return selectedNetworks?.[0] ? of(selectedNetworks[0]) : of(null);
  }),
);

const currentNetworkAtomObservable = selectedNetworkObservable.pipe(
  switchMap((selectedNetworks) => {
    return selectedNetworks?.[0]
      ? of(
          pick(selectedNetworks[0], [
            'id',
            'name',
            'endpoint',
            'endpointsList',
            'netId',
            'chainId',
            'gasBuffer',
            'networkType',
            'chainType',
            'icon',
            'scanUrl',
            'selected',
            'builtin',
          ]),
        )
      : of(null);
  }),
);

export const currentNetworkAtom = atomWithObservable(() => currentNetworkAtomObservable as Observable<Network>, { initialValue: null });
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

export const useNativeAssetOfNetwork = (networkId: string | undefined | null) => {
  return useAtomValue(nativeAssetAtomFamilyOfNetwork(networkId));
};
export const useCurrentNetworkNativeAsset = () => {
  const currentNetwork = useCurrentNetwork();
  return useAtomValue(nativeAssetAtomFamilyOfNetwork(currentNetwork?.id));
};
export const getCurrentNetworkNativeAsset = () => {
  const currentNetwork = getCurrentNetwork();
  return getAtom(nativeAssetAtomFamilyOfNetwork(currentNetwork?.id));
};
