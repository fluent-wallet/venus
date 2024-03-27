import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, of, Observable } from 'rxjs';
import { memoize } from 'lodash-es';
import { observeNetworkById } from '../../../../database/models/Network/query';
import { useCurrentNetwork } from './useCurrentNetwork';
import { type AssetInfo } from '../../AssetsTracker/types';

export const observeTokenListOfNetwork = memoize((networkId: string) =>
  observeNetworkById(networkId).pipe(switchMap((network) => network.tokenList.observe() as unknown as Observable<AssetInfo[]>)),
);

const tokenListAtomFamilyOfNetwork = atomFamily((networkId: string | undefined | null) =>
  atomWithObservable(() => (!networkId ? of([]) : observeTokenListOfNetwork(networkId)), {
    initialValue: [],
  }),
);

export const useTokenListOfNetwork = (networkId: string | undefined | null) => useAtomValue(tokenListAtomFamilyOfNetwork(networkId));
export const useTokenListOfCurrentNetwork = () => {
  const currentNetwork = useCurrentNetwork();
  return useAtomValue(tokenListAtomFamilyOfNetwork(currentNetwork?.id));
};
