import NoneNFT from '@assets/images/none-NFT.webp';
import Text from '@components/Text';
import { shouldShowNftCollectionsSkeleton } from '@modules/AssetsList/NFTsList/helpers';
import { NFTCollectionItem } from '@modules/AssetsList/NFTsList/NFTCollectionItem';
import { NFTItemsGridRow } from '@modules/AssetsList/NFTsList/NFTItemsGrid';
import { NftCollectionItemsSkeleton } from '@modules/AssetsList/NFTsList/NftCollectionRow';
import { useOpenNftCollection } from '@modules/AssetsList/NFTsList/openState';
import { SkeletonList as NftSkeletonList } from '@modules/AssetsList/NFTsList/Skeleton';
import { styles as emptyStyles } from '@modules/AssetsList/TokensList/ReceiveFunds';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import type { INftCollection, INftItem } from '@service/core';
import { useNftCollectionsOfAddress, useNftItems } from '@service/nft';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HomeTabList } from './HomeTabList';
import { buildHomeNftRows, type HomeNftsRow } from './homeNftRows';
import type { HomeTabScrollBinding } from './useHomeTabScroll';

const EMPTY_COLLECTIONS: INftCollection[] = [];
const EMPTY_ITEMS: INftItem[] = [];
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
}> = ({ scroll, topInset, minimumContentHeight }) => {
  const currentAddressQuery = useCurrentAddress();
  const addressId = currentAddressQuery.data?.id ?? '';
  const collectionsQuery = useNftCollectionsOfAddress(addressId);
  const collections = collectionsQuery.data ?? EMPTY_COLLECTIONS;
  const [open, setOpen] = useOpenNftCollection();
  const openCollection = useMemo(
    () => collections.find((collection) => collection.contractAddress.toLowerCase() === open?.contractAddress.toLowerCase()),
    [collections, open?.contractAddress],
  );
  // Keep the query mounted when virtualized collection headers leave the window.
  const itemsQuery = useNftItems({ addressId, contractAddress: openCollection?.contractAddress ?? '', enabled: Boolean(openCollection && addressId) });
  const items = itemsQuery.data ?? EMPTY_ITEMS;
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

    return buildHomeNftRows({ collections, openContractAddress: openCollection?.contractAddress, items, isFetchingItems: itemsQuery.isFetching });
  }, [collections, items, itemsQuery.isFetching, openCollection?.contractAddress, shouldShowSkeleton]);

  const renderContentItem = useCallback(
    (item: HomeNftsRow) => {
      switch (item.kind) {
        case 'nfts-skeletons':
          return <NftSkeletonList />;
        case 'nfts-empty':
          return <NftsEmptyState />;
        case 'nft-collection':
          return (
            <NFTCollectionItem
              collection={item.collection}
              isOpen={item.isOpen}
              background="home"
              onPress={() => {
                setOpen((previous) =>
                  previous?.contractAddress.toLowerCase() === item.collection.contractAddress.toLowerCase()
                    ? null
                    : { contractAddress: item.collection.contractAddress, index: item.collectionIndex },
                );
              }}
            />
          );
        case 'nft-items-skeleton':
          return <NftCollectionItemsSkeleton background="home" />;
        case 'nft-items-row':
          return (
            <NFTItemsGridRow
              collection={item.collection}
              items={item.items}
              isFirstRow={item.isFirstRow}
              isLastRow={item.isLastRow}
              background="home"
              onPressItem={handleNftPress}
            />
          );
      }
    },
    [setOpen],
  );

  return (
    <HomeTabList
      scroll={scroll}
      contentRows={contentRows}
      renderContentItem={renderContentItem}
      topInset={topInset}
      minimumContentHeight={minimumContentHeight}
      removeClippedSubviews={false}
    />
  );
};
