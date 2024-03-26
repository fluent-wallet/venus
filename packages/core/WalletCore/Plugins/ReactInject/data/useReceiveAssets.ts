import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, of } from 'rxjs';
import { memoize } from 'lodash-es';
import { observeNetworkById } from '../../../../database/models/Network/query';

export const observeAssetsOfNetwork = memoize((networkId: string) => observeNetworkById(networkId).pipe(switchMap((network) => network.assets.observe())));

const assetsAtomFamilyOfNetwork = atomFamily((networkId: string | undefined | null) =>
  atomWithObservable(() => (!networkId ? of([]) : observeAssetsOfNetwork(networkId)), {
    initialValue: [],
  }),
);

export const useAssetsOfNetwork = (networkId: string | undefined | null) => useAtomValue(assetsAtomFamilyOfNetwork(networkId));
