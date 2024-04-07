import { useCallback, useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import plugins from '@core/WalletCore/Plugins';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { useCurrentOpenNFTDetail, AssetType } from '@core/WalletCore/Plugins/ReactInject';
import { type NFTItemDetail } from '@core/WalletCore/Plugins/NFTDetailTracker';
import Text from '@components/Text';
import { screenWidth } from '@utils/deviceInfo';
import { type TabsType } from '@modules/AssetsTabs';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import NFTIcon from './NFTIcon';
import { SkeletoDetailItem } from './Skeleton';
import AssetTypeLabel from '../AssetTypeLabel';

export const getDetailSymbol = (detail: NFTItemDetail) => {
  const name = detail.name?.trim?.() ?? '';
  const tokenId = detail.tokenId;
  if (name.endsWith(`#${tokenId}`)) {
    return name;
  }
  return `${name} #${tokenId}`;
};

export const StickyNFTItem: React.FC<{ startY: number; scrollY: number; tabsType: TabsType }> = ({ startY, scrollY, tabsType }) => {
  const currentOpenNFT = useCurrentOpenNFTDetail();
  const showY = useMemo(() => startY + (currentOpenNFT?.index ?? 0) * 70, [startY, currentOpenNFT?.index]);

  if (!currentOpenNFT || currentOpenNFT?.index === undefined) return null;
  return (
    <NFTItem
      isSticky={scrollY < showY ? 'hide' : 'show'}
      data={currentOpenNFT.nft}
      onPress={() => plugins.NFTDetailTracker.setCurrentOpenNFT(undefined)}
      tabsType={tabsType}
    />
  );
};

const NFTItem: React.FC<{ data: AssetInfo; onPress: () => void; isSticky?: 'hide' | 'show'; tabsType: TabsType; showTypeLabel?: boolean }> = ({
  data,
  onPress,
  isSticky,
  tabsType,
  showTypeLabel,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable
      testID="tokenItem"
      style={({ pressed }) => [
        styles.container,
        isSticky && styles.sticky,
        { backgroundColor: pressed ? colors.underlay : tabsType === 'Home' ? colors.bgPrimary : colors.bgFourth, opacity: isSticky === 'hide' ? 0 : 1 },
      ]}
      pointerEvents={isSticky === 'hide' ? 'none' : 'auto'}
      onPress={onPress}
    >
      <NFTIcon style={styles.nftIcon} source={data.icon} />
      <View style={styles.textArea}>
        <Text style={[styles.nftName, { color: colors.textPrimary }]} numberOfLines={1}>
          {data.name}
        </Text>
        {showTypeLabel && <AssetTypeLabel assetType={data.type} />}
        <ArrowRight style={styles.arrow} width={15} height={15} color={colors.iconPrimary} />
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
  onPress?: (v: AssetInfo, n: NFTItemDetail) => void;
  index?: number;
  tabsType: TabsType;
  showTypeLabel?: boolean;
}> = ({ onPress, data, index, currentOpenNFTDetail, tabsType, showTypeLabel }) => {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    plugins.NFTDetailTracker.setCurrentOpenNFT(currentOpenNFTDetail?.nft?.contractAddress === data.contractAddress ? undefined : { nft: data, index });
  }, [data, index, currentOpenNFTDetail?.nft?.contractAddress]);

  return (
    <>
      <NFTItem data={data} onPress={handlePress} tabsType={tabsType} showTypeLabel={showTypeLabel} />
      {currentOpenNFTDetail?.nft?.contractAddress === data.contractAddress && (
        <View style={styles.itemsArea}>
          {!currentOpenNFTDetail?.items && <SkeletoDetail colors={colors} />}
          {currentOpenNFTDetail?.items &&
            currentOpenNFTDetail.items.length > 0 &&
            currentOpenNFTDetail.items.map((item) => (
              <Pressable
                style={({ pressed }) => [
                  styles.item,
                  {
                    borderColor: colors.borderThird,
                    backgroundColor: pressed ? colors.underlay : tabsType === 'Home' ? colors.bgPrimary : colors.bgFourth,
                  },
                ]}
                key={item.tokenId}
                disabled={!onPress}
                onPress={() => onPress?.(data, item)}
              >
                <NFTIcon style={styles.nftItemImg} source={item.icon} isNftItem placeholderContentFit="cover" contentFit="cover" />
                <Text style={[styles.nftNameInItem, { color: colors.textSecondary }]} numberOfLines={2}>
                  {data.name}
                </Text>
                <Text style={[styles.nftItemName, { color: colors.textPrimary }]} numberOfLines={2}>
                  {getDetailSymbol(item)}
                </Text>
                {item.amount && data.type === AssetType.ERC1155 && (
                  <Text style={[styles.nftItemAmount, { color: colors.textPrimary }]} numberOfLines={1}>
                    x{item.amount}
                  </Text>
                )}
              </Pressable>
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

export default NFTItemAndDetail;
