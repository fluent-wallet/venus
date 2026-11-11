import type { INftCollection } from '@service/core';
import { type NftListState, useNftItems } from '@service/nft';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createNftListRows } from './nftListRows';

export type { NftListRowData } from './nftListRows';

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 1, minimumViewTime: 0 };

export function useNftList(
  listState: NftListState,
  collections: readonly INftCollection[],
  { enabled = true, leadingRowCount = 0 }: { enabled?: boolean; leadingRowCount?: number } = {},
) {
  const [visibleIndices, setVisibleIndices] = useState<readonly number[]>([]);
  const contractAddresses = useMemo(() => collections.map((collection) => collection.contractAddress), [collections]);
  const { queriesByContract, expandedCollectionIds, toggleCollection, setVisibleContractAddresses, loadMore } = useNftItems(listState, contractAddresses, {
    enabled,
  });
  const buildRows = useMemo(() => createNftListRows(), []);
  const { rows, stickyHeaderIndices } = useMemo(
    () => buildRows(collections, expandedCollectionIds, queriesByContract, leadingRowCount),
    [buildRows, collections, expandedCollectionIds, queriesByContract, leadingRowCount],
  );
  // Viewability reports indices. Resolve them against current rows after refreshes or search changes.
  const visibleRows = useMemo(() => visibleIndices.flatMap((index) => rows[index - leadingRowCount] ?? []), [visibleIndices, rows, leadingRowCount]);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    const indices = viewableItems.flatMap(({ index }) => (index === null ? [] : [index]));
    setVisibleIndices((previous) =>
      previous.length === indices.length && previous.every((index, position) => index === indices[position]) ? previous : indices,
    );
  }, []);

  useEffect(() => {
    setVisibleContractAddresses(visibleRows.map((row) => row.collection.contractAddress));
  }, [setVisibleContractAddresses, visibleRows]);

  useEffect(() => {
    if (!enabled) return;
    for (const row of visibleRows) {
      if (row.kind === 'nft-items-row' && row.isNearCollectionEnd) {
        const query = queriesByContract.get(row.collection.contractAddress.toLowerCase());
        if (query?.hasNextPage && !query.isFetching && !query.isError) loadMore(row.collection.contractAddress);
      }
    }
  }, [enabled, loadMore, queriesByContract, visibleRows]);

  return {
    rows,
    stickyHeaderIndices,
    onPressCollection: toggleCollection,
    onViewableItemsChanged,
    viewabilityConfig: VIEWABILITY_CONFIG,
  };
}
