import { NftListRow } from '@modules/AssetsList/NFTsList/NftListRow';
import { type NftListRowData, useNftList } from '@modules/AssetsList/NFTsList/useNftList';
import TokenItem from '@modules/AssetsList/TokensList/TokenItem';
import { useIsFocused } from '@react-navigation/native';
import type { AssetSearchItem } from '@service/assetSearch';
import type { INftItem } from '@service/core';
import type { NftListState } from '@service/nft';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { AssetInfo } from '@utils/assetInfo';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';

type TokenSearchRow = Extract<AssetSearchItem, { kind: 'token' }>;
type SearchRow = TokenSearchRow | NftListRowData;
const keyExtractor = (item: SearchRow) => item.key;
const getItemType = (item: SearchRow) => item.kind;
const maintainVisibleContentPosition = { disabled: true };

export const AssetSearchResults: React.FC<{
  items: readonly AssetSearchItem[];
  nftListState: NftListState;
  isReceive: boolean;
  onSelect: (asset: AssetInfo, item?: INftItem) => void;
  renderFooter: () => React.ReactElement | null;
}> = ({ items, nftListState, isReceive, onSelect, renderFooter }) => {
  const isFocused = useIsFocused();
  const tokens = useMemo(() => items.filter((item): item is TokenSearchRow => item.kind === 'token'), [items]);
  const collections = useMemo(() => items.flatMap((item) => (item.kind === 'nft-collection' ? [item.collection] : [])), [items]);
  const {
    rows: nftRows,
    stickyHeaderIndices,
    onPressCollection,
    onViewableItemsChanged,
    viewabilityConfig,
  } = useNftList(nftListState, collections, { enabled: isFocused, leadingRowCount: tokens.length });
  // Search returns tokens first, followed by matching NFT collections.
  const rows = useMemo(() => [...tokens, ...nftRows], [tokens, nftRows]);
  const renderItem = useCallback<ListRenderItem<SearchRow>>(
    ({ item }) =>
      item.kind === 'token' ? (
        <TokenItem data={item.asset} showTypeLabel onPress={onSelect} hidePrice={isReceive} hideBalance={isReceive} showAddress={isReceive} />
      ) : (
        <NftListRow row={item} showTypeLabel onPressCollection={onPressCollection} onSelect={onSelect} />
      ),
    [isReceive, onSelect, onPressCollection],
  );

  return (
    <FlashList
      data={rows}
      style={styles.list}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      stickyHeaderIndices={stickyHeaderIndices}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.content}
      maintainVisibleContentPosition={maintainVisibleContentPosition}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingBottom: 16 },
});
