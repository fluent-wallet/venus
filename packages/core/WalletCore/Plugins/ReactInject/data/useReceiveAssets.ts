import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { memoize, unionBy } from 'lodash-es';
import { map, type Observable, of, switchMap } from 'rxjs';
import { observeNetworkById } from '../../../../database/models/Network/query';
import type { AssetInfo } from '../../AssetsTracker/types';
import { useCurrentNetwork } from './useCurrentNetwork';

export const observeTokenListOfNetwork = memoize((networkId: string) =>
  observeNetworkById(networkId).pipe(switchMap((network) => network.tokenList.observe() as unknown as Observable<AssetInfo[]>)),
);

const tokenListAtomFamilyOfNetwork = atomFamily((networkId: string | undefined | null) =>
  atomWithObservable(
    () =>
      (!networkId ? of([]) : observeTokenListOfNetwork(networkId)).pipe(
        map((_tokenList) => {
          const tokenList = unionBy(_tokenList, 'contractAddress');
          return tokenList.sort((tokenA, tokenB) => {
            if (tokenA.type === 'Native' && tokenB.type !== 'Native') {
              return -1;
            } else if (tokenA.type !== 'Native' && tokenB.type === 'Native') {
              return 1;
            }

            if (tokenA.name.toLowerCase() > tokenB.name.toLowerCase()) {
              return 1;
            } else if (tokenA.name.toLowerCase() < tokenB.name.toLowerCase()) {
              return -1;
            }

            return 0;
          });
        }),
      ),
    {
      initialValue: [],
    },
  ),
);

export const useTokenListOfNetwork = (networkId: string | undefined | null) => useAtomValue(tokenListAtomFamilyOfNetwork(networkId));
export const useTokenListOfCurrentNetwork = () => {
  const currentNetwork = useCurrentNetwork();
  return useAtomValue(tokenListAtomFamilyOfNetwork(currentNetwork?.id));
};
