import ArrowRight from '@assets/icons/arrow-right2.svg';
import Text from '@components/Text';
import type { AssetType } from '@core/types';
import AssetTypeLabel from '@modules/AssetsList/AssetTypeLabel';
import { useTheme } from '@react-navigation/native';
import type { INftCollection } from '@service/core';
import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import NFTIcon from './NFTIcon';

export const NFTCollectionItem: React.FC<{
  collection: INftCollection;
  onPress?: () => void;
  showTypeLabel?: boolean;
  isOpen?: boolean;
  background?: 'home' | 'sheet';
}> = ({ collection, onPress, showTypeLabel, isOpen = false, background = 'sheet' }) => {
  const { colors } = useTheme();

  const bg = background === 'home' ? colors.bgPrimary : colors.bgFourth;

  return (
    <Pressable
      testID="tokenItem"
      style={({ pressed }) => [styles.container, { backgroundColor: pressed ? colors.underlay : bg }]}
      disabled={!onPress}
      onPress={onPress}
    >
      <NFTIcon style={styles.nftIcon} source={collection.icon ?? undefined} />
      <View style={styles.textArea}>
        <Text style={[styles.nftName, { color: colors.textPrimary }]} numberOfLines={1}>
          {collection.name ?? collection.symbol ?? collection.contractAddress}
        </Text>
        {showTypeLabel && <AssetTypeLabel assetType={collection.type as unknown as AssetType} />}
        <ArrowRight style={[styles.arrow, { transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }]} width={15} height={15} color={colors.iconPrimary} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 70,
  },
  nftIcon: {
    width: 40,
    height: 40,
  },
  textArea: {
    flex: 1,
    marginLeft: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  nftName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    maxWidth: 160,
  },
  arrow: {
    marginLeft: 'auto',
  },
});
