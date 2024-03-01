import { useCallback, useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import plugins from '@core/WalletCore/Plugins';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { useCurrentOpenNFTDetail } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import { screenWidth } from '@utils/deviceInfo';
import NFTIcon from './NFTIcon';
import { SkeletoDetailItem } from './Skeleton';

export const StickyNFTItem: React.FC<{ startY: number; scrollY: number }> = ({ startY, scrollY }) => {
  const currentOpenNFT = useCurrentOpenNFTDetail();
  const showY = useMemo(() => startY + (currentOpenNFT?.index ?? 0) * 70, [startY, currentOpenNFT?.index]);
  if (!currentOpenNFT) return null;
  return (
    <NFTItem isSticky={scrollY < showY ? 'hide' : 'show'} data={currentOpenNFT.nft} onPress={() => plugins.NFTDetailTracker.setCurrentOpenNFT(undefined)} />
  );
};

const NFTItem: React.FC<{ data: AssetInfo; onPress: () => void; isSticky?: 'hide' | 'show' }> = ({ data, onPress, isSticky }) => {
  const { colors } = useTheme();

  return (
    <Pressable
      testID="tokenItem"
      style={({ pressed }) => [
        styles.container,
        isSticky && styles.sticky,
        { backgroundColor: pressed ? colors.underlay : colors.bgPrimary, opacity: isSticky === 'hide' ? 0 : 1 },
      ]}
      pointerEvents={isSticky === 'hide' ? 'none' : 'auto'}
      onPress={onPress}
    >
      <NFTIcon style={styles.nftIcon} source={data.icon} />
      <View style={styles.textArea}>
        <Text style={[styles.nftName, { color: colors.textPrimary }]} numberOfLines={1}>
          {data.name}
        </Text>
        <ArrowRight width={15} height={15} color={colors.iconPrimary} />
      </View>
    </Pressable>
  );
};

const SkeletoDetail: React.FC<{ colors: ReturnType<typeof useTheme>['colors'] }> = ({ colors }) =>
  Array.from({ length: 2 }).map((_, index) => (
    <View style={[styles.item, { borderColor: colors.borderThird }]} key={index}>
      <SkeletoDetailItem colors={colors} />
    </View>
  ));

const NFTItemAndDetail: React.FC<{
  data: AssetInfo;
  currentOpenNFTDetail: ReturnType<typeof useCurrentOpenNFTDetail>;
  onPress?: (v: AssetInfo) => void;
  index: number;
}> = ({ onPress, data, index, currentOpenNFTDetail }) => {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    plugins.NFTDetailTracker.setCurrentOpenNFT(currentOpenNFTDetail?.nft?.contractAddress === data.contractAddress ? undefined : { nft: data, index });
  }, [data, index, currentOpenNFTDetail?.nft?.contractAddress]);

  return (
    <>
      <NFTItem data={data} onPress={handlePress} />
      {currentOpenNFTDetail?.nft?.contractAddress === data.contractAddress && (
        <View style={styles.itemsArea}>
          {!currentOpenNFTDetail?.items && <SkeletoDetail colors={colors} />}
          {currentOpenNFTDetail?.items &&
            currentOpenNFTDetail.items.length > 0 &&
            currentOpenNFTDetail.items.map((item) => (
              <View style={[styles.item, { borderColor: colors.borderThird }]} key={item.tokenId}>
                <NFTIcon style={styles.nftItemImg} source={item.icon} isNftItem placeholderContentFit="cover" contentFit="cover" />
                <Text style={[styles.nftNameInItem, { color: colors.textSecondary }]}>{data.name}</Text>
                <Text style={[styles.nftItemName, { color: colors.textPrimary }]}>
                  {item.name} #{item.tokenId}
                </Text>
              </View>
            ))}
        </View>
      )}
    </>
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
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nftName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    maxWidth: 160,
  },
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
});

export default NFTItemAndDetail;
