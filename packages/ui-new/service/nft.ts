import { type InfiniteData, type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getNftService, type INftCollection, type INftItem, type INftItemsPage } from './core';
import { createNftListState, type NftListState } from './nftListState';

export type { NftItemsQuery, NftListState } from './nftListState';

const NFT_REFRESH_INTERVAL_MS = 30_000;

export const getNftRootKey = () => ['nft'] as const;
export const getNftAddressKey = (addressId: string) => [...getNftRootKey(), addressId] as const;
export const getNftCollectionsByAddressKey = (addressId: string) => [...getNftAddressKey(addressId), 'collections'] as const;
export const getNftItemsKey = (addressId: string, contractAddress: string) => [...getNftAddressKey(addressId), 'items', contractAddress.toLowerCase()] as const;

export function useNftCollectionsOfAddress(addressId: string, options: { enabled?: boolean } = {}): UseQueryResult<INftCollection[]> {
  const service = getNftService();
  const enabled = useNftQueryEnabled((options.enabled ?? true) && !!addressId);

  return useQuery({
    queryKey: getNftCollectionsByAddressKey(addressId || 'none'),
    queryFn: () => service.listCollections({ addressId }),
    enabled,
    staleTime: NFT_REFRESH_INTERVAL_MS,
    refetchInterval: NFT_REFRESH_INTERVAL_MS,
    retry: false,
  });
}

export function useNftListState(addressId: string): NftListState {
  const client = useQueryClient();
  const service = getNftService();
  return useMemo(
    () =>
      createNftListState(addressId, client, (contractAddress) => ({
        queryKey: getNftItemsKey(addressId, contractAddress),
        queryFn: ({ pageParam }) => service.getItemsPage({ addressId, contractAddress, cursor: pageParam }),
        initialPageParam: '0',
        getNextPageParam: (lastPage, _pages, _lastParam, pageParams) =>
          lastPage.nextCursor != null && !pageParams.includes(lastPage.nextCursor) ? lastPage.nextCursor : undefined,
        select: mergeNftItemPages,
        staleTime: NFT_REFRESH_INTERVAL_MS,
        refetchInterval: NFT_REFRESH_INTERVAL_MS,
        retry: false,
      })),
    [addressId, client, service],
  );
}

export function useNftItems(listState: NftListState, contractAddresses: readonly string[], { enabled = true }: { enabled?: boolean } = {}) {
  const queryEnabled = useNftQueryEnabled(enabled && !!listState.addressId);
  const queriesByContract = useAtomValue(listState.itemsAtom, { store: listState.store });
  const expandedCollectionIds = useAtomValue(listState.expandedCollectionIdsAtom, { store: listState.store });

  useEffect(() => {
    listState.setView({ enabled: queryEnabled, contractAddresses });
  }, [listState, queryEnabled, contractAddresses]);

  useEffect(
    () => () => {
      listState.setView({ enabled: false, contractAddresses: [] });
    },
    [listState],
  );

  return {
    queriesByContract,
    expandedCollectionIds,
    toggleCollection: listState.toggleCollection,
    setVisibleContractAddresses: listState.setVisibleContractAddresses,
    loadMore: listState.loadMore,
  };
}

function mergeNftItemPages(data: InfiniteData<INftItemsPage, string>): INftItem[] {
  const itemsByTokenId = new Map<string, INftItem>();
  for (const page of data.pages) {
    for (const item of page.items) itemsByTokenId.set(item.tokenId, item);
  }

  return [...itemsByTokenId.values()];
}

const subscribeToAppState = (onChange: () => void) => {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
};
const isAppInForeground = () => AppState.currentState === null || AppState.currentState === 'active';

function useNftQueryEnabled(enabled: boolean): boolean {
  const isForeground = useSyncExternalStore(subscribeToAppState, isAppInForeground);
  return enabled && isForeground;
}
