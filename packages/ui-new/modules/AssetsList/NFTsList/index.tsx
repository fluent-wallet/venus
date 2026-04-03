import NoneNFT from '@assets/images/none-NFT.webp';
import Text from '@components/Text';
import type { TabsType } from '@modules/AssetsTabs';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import type { INftItem } from '@service/core';
import { useNftCollectionsOfAddress } from '@service/nft';
import type { AssetInfo } from '@utils/assetInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { styles } from '../TokensList/ReceiveFunds';
import { shouldShowNftCollectionsSkeleton } from './helpers';
import { NftCollectionRow } from './NftCollectionRow';
import { SkeletonList } from './Skeleton';

interface Props {
  onPressItem?: (asset: AssetInfo, nftItemDetail: INftItem) => void;
  tabsType: TabsType;
}

const NFTList: React.FC<Props> = ({ onPressItem, tabsType }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

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

  if (shouldShowSkeleton) {
    return <SkeletonList />;
  }

  if (!collections.length) {
    return (
      <>
        <Image style={styles.noneImg} source={NoneNFT} contentFit="contain" />
        <Text style={[styles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noNFT')}</Text>
      </>
    );
  }

  return collections.map((collection, index) => (
    <NftCollectionRow
      key={collection.id}
      addressId={addressId}
      collection={collection}
      index={index}
      background={tabsType === 'Home' ? 'home' : 'sheet'}
      onSelect={(asset, item) => {
        onPressItem?.(asset, item);
      }}
    />
  ));
};

export default NFTList;
