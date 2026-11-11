import type { INftCollection, INftItem } from '@service/core';
import type { NftItemsQuery } from '@service/nft';

export type NftListRowData =
  | { key: string; kind: 'nft-collection'; collection: INftCollection; isOpen: boolean }
  | { key: string; kind: 'nft-items-skeleton'; collection: INftCollection }
  | {
      key: string;
      kind: 'nft-items-row';
      collection: INftCollection;
      items: INftItem[];
      isFirstRow: boolean;
      isLastRow: boolean;
      isNearCollectionEnd: boolean;
    };

type CollectionContent = {
  collection: INftCollection;
  isOpen: boolean;
  items: INftItem[];
  isPending: boolean;
  isFetchingNextPage: boolean;
};
type CollectionRows = CollectionContent & { rows: NftListRowData[] };

const ITEMS_PER_ROW = 2;
const PRELOAD_ROW_COUNT = 3;
const EMPTY_ITEMS: INftItem[] = [];

// Each list owns this memoized projection; unchanged collections keep their rows.
export function createNftListRows() {
  let previousCollections: CollectionRows[] = [];
  let previousLeadingRowCount = 0;
  let result: { rows: NftListRowData[]; stickyHeaderIndices: number[] | undefined } = { rows: [], stickyHeaderIndices: undefined };

  return (collections: readonly INftCollection[], expandedIds: ReadonlySet<string>, queries: ReadonlyMap<string, NftItemsQuery>, leadingRowCount: number) => {
    const previousById = new Map(previousCollections.map((entry) => [entry.collection.id, entry]));
    const nextCollections = collections.map((collection): CollectionRows => {
      const isOpen = expandedIds.has(collection.id);
      const query = isOpen ? queries.get(collection.contractAddress.toLowerCase()) : undefined;
      const content: CollectionContent = {
        collection,
        isOpen,
        items: query?.data ?? EMPTY_ITEMS,
        isPending: isOpen && (!query || query.isPending),
        isFetchingNextPage: query?.isFetchingNextPage ?? false,
      };
      const previous = previousById.get(collection.id);
      if (
        previous &&
        previous.collection === collection &&
        previous.isOpen === isOpen &&
        previous.items === content.items &&
        previous.isPending === content.isPending &&
        previous.isFetchingNextPage === content.isFetchingNextPage
      )
        return previous;
      return { ...content, rows: buildCollectionRows(content, previous?.rows) };
    });

    if (
      previousLeadingRowCount === leadingRowCount &&
      nextCollections.length === previousCollections.length &&
      nextCollections.every((entry, index) => entry === previousCollections[index])
    )
      return result;

    const rows: NftListRowData[] = [];
    const stickyHeaderIndices: number[] = [];
    for (const entry of nextCollections) {
      if (entry.isOpen) stickyHeaderIndices.push(leadingRowCount + rows.length);
      for (const row of entry.rows) rows.push(row);
    }
    previousCollections = nextCollections;
    previousLeadingRowCount = leadingRowCount;
    result = { rows, stickyHeaderIndices: stickyHeaderIndices.length ? stickyHeaderIndices : undefined };
    return result;
  };
}

function buildCollectionRows(content: CollectionContent, previousRows: NftListRowData[] = []): NftListRowData[] {
  const { collection, isOpen, items, isPending, isFetchingNextPage } = content;
  const rows: NftListRowData[] = [];
  const previousByKey = new Map(previousRows.map((row) => [row.key, row]));
  const addRow = (row: NftListRowData) => {
    const previous = previousByKey.get(row.key);
    rows.push(previous && sameRow(previous, row) ? previous : row);
  };
  addRow({ key: collection.id, kind: 'nft-collection', collection, isOpen });
  if (!isOpen) return rows;
  if (isPending) {
    addRow({ key: `${collection.id}:skeleton`, kind: 'nft-items-skeleton', collection });
    return rows;
  }

  // An empty open collection keeps the existing grid's vertical spacing.
  const itemCount = Math.max(items.length, 1);
  for (let index = 0; index < itemCount; index += ITEMS_PER_ROW) {
    addRow({
      key: `${collection.id}:items:${items[index]?.tokenId ?? 'empty'}`,
      kind: 'nft-items-row',
      collection,
      items: items.slice(index, index + ITEMS_PER_ROW),
      isFirstRow: index === 0,
      isLastRow: index + ITEMS_PER_ROW >= items.length,
      isNearCollectionEnd: index + ITEMS_PER_ROW * PRELOAD_ROW_COUNT >= items.length,
    });
  }
  if (isFetchingNextPage) {
    addRow({ key: `${collection.id}:loading-more`, kind: 'nft-items-skeleton', collection });
  }
  return rows;
}

function sameRow(previous: NftListRowData, next: NftListRowData): boolean {
  if (previous.collection !== next.collection) return false;
  switch (next.kind) {
    case 'nft-collection':
      return previous.kind === next.kind && previous.isOpen === next.isOpen;
    case 'nft-items-skeleton':
      return previous.kind === next.kind;
    case 'nft-items-row':
      return (
        previous.kind === next.kind &&
        previous.isFirstRow === next.isFirstRow &&
        previous.isLastRow === next.isLastRow &&
        previous.isNearCollectionEnd === next.isNearCollectionEnd &&
        previous.items.length === next.items.length &&
        previous.items.every((item, index) => item === next.items[index])
      );
  }
}
