import NoneNFT from '@assets/images/none-NFT.webp';
import Text from '@components/Text';
import { shouldShowNftCollectionsSkeleton } from '@modules/AssetsList/NFTsList/helpers';
import { NftCollectionRow } from '@modules/AssetsList/NFTsList/NftCollectionRow';
import { SkeletonList as NftSkeletonList } from '@modules/AssetsList/NFTsList/Skeleton';
import { styles as emptyStyles } from '@modules/AssetsList/TokensList/ReceiveFunds';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import type { INftCollection } from '@service/core';
import { useNftCollectionsOfAddress } from '@service/nft';
import { Image } from 'expo-image';
import type React from 'react';
import { type RefObject, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import { type HomeFlatListRef, HomeTabList } from './HomeTabList';

export type HomeNftsRow =
  | { key: 'nfts-skeletons'; kind: 'nfts-skeletons' }
  | { key: 'nfts-empty'; kind: 'nfts-empty' }
  | { key: string; kind: 'nft-collection'; addressId: string; index: number; collection: INftCollection };

const NftsEmptyState: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Image style={emptyStyles.noneImg} source={NoneNFT} contentFit="contain" />
      <Text style={[emptyStyles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noNFT')}</Text>
    </>
  );
};

export const HomeNftsTab: React.FC<{
  flatListRef: RefObject<HomeFlatListRef<HomeNftsRow> | null>;
  topInset: number;
  onLayoutHeightChange?: (height: number) => void;
  onContentHeightChange?: (height: number) => void;
  scrollOffset: SharedValue<number>;
  sharedScrollY: SharedValue<number>;
  isActive: boolean;
  scrollGesture: GestureType;
}> = ({ flatListRef, topInset, onLayoutHeightChange, onContentHeightChange, scrollOffset, sharedScrollY, isActive, scrollGesture }) => {
  const currentAddressQuery = useCurrentAddress();
  const addressId = currentAddressQuery.data?.id ?? '';
  const collectionsQuery = useNftCollectionsOfAddress(addressId);
  const collections = collectionsQuery.data ?? [];
  const shouldShowSkeleton = shouldShowNftCollectionsSkeleton({
    addressId,
    collectionsCount: collections.length,
    collectionsStatus: collectionsQuery.status,
    currentAddressStatus: currentAddressQuery.status,
  });

  const contentRows = useMemo<HomeNftsRow[]>(() => {
    if (shouldShowSkeleton) {
      return [{ key: 'nfts-skeletons', kind: 'nfts-skeletons' }];
    }

    if (!collections.length) {
      return [{ key: 'nfts-empty', kind: 'nfts-empty' }];
    }

    return collections.map((collection, index) => ({
      key: collection.id,
      kind: 'nft-collection',
      addressId,
      index,
      collection,
    }));
  }, [addressId, collections, shouldShowSkeleton]);

  const renderContentItem = useCallback((item: HomeNftsRow) => {
    switch (item.kind) {
      case 'nfts-skeletons':
        return <NftSkeletonList />;
      case 'nfts-empty':
        return <NftsEmptyState />;
      case 'nft-collection':
        return <NftCollectionRow addressId={item.addressId} collection={item.collection} index={item.index} background="home" onSelect={() => undefined} />;
      default:
        return null;
    }
  }, []);

  return (
    <HomeTabList
      flatListRef={flatListRef}
      contentRows={contentRows}
      renderContentItem={renderContentItem}
      topInset={topInset}
      onLayoutHeightChange={onLayoutHeightChange}
      onContentHeightChange={onContentHeightChange}
      scrollOffset={scrollOffset}
      sharedScrollY={sharedScrollY}
      isActive={isActive}
      scrollGesture={scrollGesture}
      removeClippedSubviews={false}
    />
  );
};
