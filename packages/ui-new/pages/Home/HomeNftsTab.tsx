import NoneNFT from '@assets/images/none-NFT.webp';
import Text from '@components/Text';
import { shouldShowNftCollectionsSkeleton } from '@modules/AssetsList/NFTsList/helpers';
import { NftListRow } from '@modules/AssetsList/NFTsList/NftListRow';
import { SkeletonList as NftSkeletonList } from '@modules/AssetsList/NFTsList/Skeleton';
import { type NftListRowData, useNftList } from '@modules/AssetsList/NFTsList/useNftList';
import { styles as emptyStyles } from '@modules/AssetsList/TokensList/ReceiveFunds';
import { useIsFocused, useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import type { INftCollection } from '@service/core';
import { useNftCollectionsOfAddress, useNftListState } from '@service/nft';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HomeTabList } from './HomeTabList';
import type { HomeTabScrollBinding } from './useHomeTabScroll';

const EMPTY_COLLECTIONS: INftCollection[] = [];
type HomeNftsRow = NftListRowData | { key: 'nfts-skeletons'; kind: 'nfts-skeletons' } | { key: 'nfts-empty'; kind: 'nfts-empty' };
const getItemType = (row: HomeNftsRow) => row.kind;
// Home cards keep press feedback without opening a detail screen.
const handleNftPress = () => undefined;

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
  scroll: HomeTabScrollBinding;
  topInset: number;
  minimumContentHeight: number;
  stickyHeaderOffset: number;
  isActive: boolean;
}> = ({ scroll, topInset, minimumContentHeight, stickyHeaderOffset, isActive }) => {
  const isFocused = useIsFocused();
  const enabled = isActive && isFocused;
  const currentAddressQuery = useCurrentAddress();
  const addressId = currentAddressQuery.data?.id ?? '';
  const collectionsQuery = useNftCollectionsOfAddress(addressId, { enabled });
  const collections = collectionsQuery.data ?? EMPTY_COLLECTIONS;
  const nftListState = useNftListState(addressId);
  const { rows, stickyHeaderIndices, onPressCollection, onViewableItemsChanged, viewabilityConfig } = useNftList(nftListState, collections, {
    enabled,
  });
  const stickyHeaderConfig = useMemo(() => ({ offset: stickyHeaderOffset }), [stickyHeaderOffset]);
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

    return rows;
  }, [collections.length, rows, shouldShowSkeleton]);

  const renderContentItem = useCallback(
    (item: HomeNftsRow) => {
      switch (item.kind) {
        case 'nfts-skeletons':
          return <NftSkeletonList />;
        case 'nfts-empty':
          return <NftsEmptyState />;
        default:
          return <NftListRow row={item} background="home" onPressCollection={onPressCollection} onSelect={handleNftPress} />;
      }
    },
    [onPressCollection],
  );

  return (
    <HomeTabList
      scroll={scroll}
      contentRows={contentRows}
      renderContentItem={renderContentItem}
      topInset={topInset}
      minimumContentHeight={minimumContentHeight}
      getItemType={getItemType}
      stickyHeaderIndices={stickyHeaderIndices}
      stickyHeaderConfig={stickyHeaderConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      removeClippedSubviews={false}
    />
  );
};
