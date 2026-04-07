import Text from '@components/Text';
import { ASSET_TYPE } from '@core/types';
import { useTheme } from '@react-navigation/native';
import type { INftCollection, INftItem } from '@service/core';
import { screenWidth } from '@utils/deviceInfo';
import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import NFTIcon from './NFTIcon';

export const getDetailSymbol = (detail: INftItem) => {
  const name = detail.name?.trim?.() ?? '';
  const tokenId = detail.tokenId;
  if (name.endsWith(`#${tokenId}`)) {
    return name;
  }
  return `${name} #${tokenId}`;
};

export const NFTItemsGrid: React.FC<{
  collection: INftCollection;
  items: INftItem[];
  onPressItem?: (item: INftItem) => void;
  background?: 'home' | 'sheet';
}> = ({ collection, items, onPressItem, background = 'sheet' }) => {
  const { colors } = useTheme();
  const bg = background === 'home' ? colors.bgPrimary : colors.bgFourth;

  return (
    <View style={styles.itemsArea}>
      {items.map((item) => (
        <Pressable
          key={item.tokenId}
          style={({ pressed }) => [
            styles.item,
            {
              borderColor: colors.borderThird,
              backgroundColor: pressed ? colors.underlay : bg,
            },
          ]}
          disabled={!onPressItem}
          onPress={() => onPressItem?.(item)}
        >
          <NFTIcon style={styles.nftItemImg} source={item.icon ?? undefined} isNftItem placeholderContentFit="cover" contentFit="cover" />
          <Text style={[styles.nftNameInItem, { color: colors.textSecondary }]} numberOfLines={2}>
            {collection.name ?? collection.symbol ?? ''}
          </Text>
          <Text style={[styles.nftItemName, { color: colors.textPrimary }]} numberOfLines={2}>
            {getDetailSymbol(item)}
          </Text>
          {item.amount && collection.type === ASSET_TYPE.ERC1155 && (
            <Text style={[styles.nftItemAmount, { color: colors.textPrimary }]} numberOfLines={1}>
              x{item.amount}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  itemsArea: {
    marginVertical: 4,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 56,
    paddingRight: 16,
    gap: 16,
  },
  item: {
    position: 'relative',
    flexGrow: 0,
    flexShrink: 1,
    width: (screenWidth - 56 - 16 - 16) / 2,
    minHeight: 205,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  nftItemImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
  },
  nftNameInItem: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  nftItemName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  nftItemAmount: {
    position: 'absolute',
    right: 12,
    top: 12,
    fontSize: 10,
    lineHeight: 12,
    maxWidth: 108,
    paddingHorizontal: 7,
    backgroundColor: 'white',
    borderRadius: 6,
  },
});
