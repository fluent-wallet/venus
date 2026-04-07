import { useTheme } from '@react-navigation/native';
import type { INftCollection, INftItem } from '@service/core';
import { useNftItems } from '@service/nft';
import type { AssetInfo } from '@utils/assetInfo';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { NFTCollectionItem } from './NFTCollectionItem';
import { NFTItemsGrid } from './NFTItemsGrid';
import { useOpenNftCollection } from './openState';
import { SkeletoDetailItem } from './Skeleton';

const DETAIL_SKELETON_KEYS = ['detail-skeleton-1', 'detail-skeleton-2'] as const;

function toNftAssetInfo(params: { collection: Pick<INftCollection, 'contractAddress' | 'type' | 'name' | 'symbol' | 'icon'>; item: INftItem }): AssetInfo {
  return {
    type: params.collection.type,
    contractAddress: params.collection.contractAddress,
    name: params.collection.name ?? '',
    symbol: params.collection.symbol ?? '',
    decimals: 0,
    balance: params.item.amount,
    icon: params.collection.icon ?? undefined,
  };
}

const DetailSkeleton: React.FC<{ background: 'home' | 'sheet' }> = memo(({ background }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.detailSkeletonWrapper, { backgroundColor: background === 'home' ? colors.bgPrimary : colors.bgFourth }]}>
      {DETAIL_SKELETON_KEYS.map((key) => (
        <View key={key} style={[styles.detailSkeletonItem, { borderColor: colors.borderThird }]}>
          <SkeletoDetailItem colors={colors} />
        </View>
      ))}
    </View>
  );
});

export const NftCollectionRow: React.FC<{
  addressId: string;
  index: number;
  collection: INftCollection;
  onSelect: (asset: AssetInfo, item: INftItem) => void;
  background?: 'home' | 'sheet';
  showTypeLabel?: boolean;
}> = memo(({ addressId, index, collection, onSelect, background = 'sheet', showTypeLabel = false }) => {
  const [open, setOpen] = useOpenNftCollection();
  const isOpen = open?.contractAddress?.toLowerCase() === collection.contractAddress.toLowerCase();

  const { data: items = [], isFetching } = useNftItems({
    addressId,
    contractAddress: collection.contractAddress,
    enabled: isOpen,
  });

  return (
    <View>
      <NFTCollectionItem
        collection={collection}
        background={background}
        isOpen={isOpen}
        showTypeLabel={showTypeLabel}
        onPress={() => {
          setOpen(isOpen ? null : { contractAddress: collection.contractAddress, index });
        }}
      />
      {isOpen &&
        (isFetching && items.length === 0 ? (
          <DetailSkeleton background={background} />
        ) : (
          <NFTItemsGrid
            collection={collection}
            items={items}
            background={background}
            onPressItem={(item) => {
              onSelect(toNftAssetInfo({ collection, item }), item);
            }}
          />
        ))}
    </View>
  );
});

const styles = StyleSheet.create({
  detailSkeletonWrapper: {
    marginVertical: 4,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 56,
    paddingRight: 16,
    gap: 16,
  },
  detailSkeletonItem: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
});
