import type { INftCollection, INftItem } from '@service/core';
import type { AssetInfo } from '@utils/assetInfo';
import type React from 'react';
import { memo, useCallback } from 'react';
import { toNftAssetInfo } from './helpers';
import { NFTCollectionItem } from './NFTCollectionItem';
import { NFTItemsGridRow } from './NFTItemsGrid';
import { NftCollectionItemsSkeleton } from './Skeleton';
import type { NftListRowData } from './useNftList';

export const NftListRow: React.FC<{
  row: NftListRowData;
  background?: 'home' | 'sheet';
  showTypeLabel?: boolean;
  onPressCollection: (collection: INftCollection) => void;
  onSelect?: (asset: AssetInfo, item: INftItem) => void;
}> = memo(({ row, background = 'sheet', showTypeLabel, onPressCollection, onSelect }) => {
  const { collection } = row;
  const handlePressCollection = useCallback(() => onPressCollection(collection), [collection, onPressCollection]);
  const handlePressItem = useCallback(
    (item: INftItem) => {
      onSelect?.(toNftAssetInfo({ collection, item }), item);
    },
    [collection, onSelect],
  );

  switch (row.kind) {
    case 'nft-collection':
      return (
        <NFTCollectionItem
          collection={row.collection}
          isOpen={row.isOpen}
          background={background}
          showTypeLabel={showTypeLabel}
          onPress={handlePressCollection}
        />
      );
    case 'nft-items-skeleton':
      return <NftCollectionItemsSkeleton background={background} />;
    case 'nft-items-row':
      return (
        <NFTItemsGridRow
          collection={row.collection}
          items={row.items}
          isFirstRow={row.isFirstRow}
          isLastRow={row.isLastRow}
          background={background}
          onPressItem={onSelect ? handlePressItem : undefined}
        />
      );
  }
});
