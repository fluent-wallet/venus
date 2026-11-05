import type { INftCollection, INftItem } from '@service/core';

export type HomeNftsRow =
  | { key: 'nfts-skeletons'; kind: 'nfts-skeletons' }
  | { key: 'nfts-empty'; kind: 'nfts-empty' }
  | { key: string; kind: 'nft-collection'; collectionIndex: number; collection: INftCollection; isOpen: boolean }
  | { key: string; kind: 'nft-items-skeleton' }
  | { key: string; kind: 'nft-items-row'; collection: INftCollection; items: INftItem[]; isFirstRow: boolean; isLastRow: boolean };

export function buildHomeNftRows({
  collections,
  openContractAddress,
  items,
  isFetchingItems,
}: {
  collections: INftCollection[];
  openContractAddress?: string;
  items: INftItem[];
  isFetchingItems: boolean;
}): HomeNftsRow[] {
  const rows: HomeNftsRow[] = [];
  const openContract = openContractAddress?.toLowerCase();

  // Sticky headers use collection indices, not flattened row indices.
  for (const [collectionIndex, collection] of collections.entries()) {
    const isOpen = collection.contractAddress.toLowerCase() === openContract;
    rows.push({ key: collection.id, kind: 'nft-collection', collectionIndex, collection, isOpen });
    if (!isOpen) continue;

    if (isFetchingItems && items.length === 0) {
      rows.push({ key: `${collection.id}:skeleton`, kind: 'nft-items-skeleton' });
      continue;
    }

    // An empty open collection keeps the existing grid's vertical spacing.
    for (let offset = 0; offset < Math.max(items.length, 1); offset += 2) {
      rows.push({
        key: `${collection.id}:items:${items[offset]?.tokenId ?? 'empty'}`,
        kind: 'nft-items-row',
        collection,
        items: items.slice(offset, offset + 2),
        isFirstRow: offset === 0,
        isLastRow: offset + 2 >= items.length,
      });
    }
  }

  return rows;
}
