import NoneNFT from '@assets/images/none-NFT.webp';
import Text from '@components/Text';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import type { TabsType } from '@modules/AssetsTabs';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import type { INftCollection, INftItem } from '@service/core';
import { useNftCollectionsOfAddress, useNftItems } from '@service/nft';
import { Image } from 'expo-image';
import type React from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { styles } from '../TokensList/ReceiveFunds';
import { NFTCollectionItem } from './NFTCollectionItem';
import { NFTItemsGrid } from './NFTItemsGrid';
import { useOpenNftCollection } from './openState';
import { SkeletoDetailItem, SkeletonList } from './Skeleton';

interface Props {
  onPressItem?: (asset: AssetInfo, nftItemDetail: INftItem) => void;
  tabsType: TabsType;
}

function toLegacyNftAssetInfo(params: { collection: INftCollection; item: INftItem }): AssetInfo {
  return {
    type: params.collection.type as unknown as AssetInfo['type'],
    contractAddress: params.collection.contractAddress,
    name: params.collection.name ?? '',
    symbol: params.collection.symbol ?? '',
    decimals: 0,
    balance: params.item.amount,
    icon: params.collection.icon ?? undefined,
  };
}

const DetailSkeleton: React.FC<{ tabsType: TabsType }> = ({ tabsType }) => {
  const { colors } = useTheme();
  const wrapperStyle = { backgroundColor: tabsType === 'Home' ? colors.bgPrimary : colors.bgFourth };

  return (
    <View style={[{ marginVertical: 4, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 56, paddingRight: 16, gap: 16 }, wrapperStyle]}>
      {Array.from({ length: 2 }).map((_, index) => (
        <View key={index} style={{ borderColor: colors.borderThird, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 }}>
          <SkeletoDetailItem colors={colors} />
        </View>
      ))}
    </View>
  );
};

const CollectionRow: React.FC<{
  addressId: string;
  collection: INftCollection;
  index: number;
  tabsType: TabsType;
  onPressItem?: (asset: AssetInfo, nftItemDetail: INftItem) => void;
}> = memo(({ addressId, collection, index, tabsType, onPressItem }) => {
  const [open, setOpen] = useOpenNftCollection();
  const isOpen = open?.contractAddress?.toLowerCase() === collection.contractAddress.toLowerCase();

  const { data: items = [], isFetching } = useNftItems({
    addressId,
    contractAddress: collection.contractAddress,
    enabled: isOpen,
  });

  const background = tabsType === 'Home' ? 'home' : 'sheet';

  return (
    <>
      <NFTCollectionItem
        collection={collection}
        background={background}
        isOpen={isOpen}
        onPress={() => {
          setOpen(isOpen ? null : { contractAddress: collection.contractAddress, index });
        }}
      />
      {isOpen &&
        (isFetching && items.length === 0 ? (
          <DetailSkeleton tabsType={tabsType} />
        ) : (
          <NFTItemsGrid
            collection={collection}
            items={items}
            background={background}
            onPressItem={(item) => {
              onPressItem?.(toLegacyNftAssetInfo({ collection, item }), item);
            }}
          />
        ))}
    </>
  );
});

const NFTList: React.FC<Props> = ({ onPressItem, tabsType }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const { data: currentAddress } = useCurrentAddress();
  const addressId = currentAddress?.id ?? '';

  const collectionsQuery = useNftCollectionsOfAddress(addressId);
  const collections = collectionsQuery.data ?? [];

  if (collectionsQuery.isLoading && collections.length === 0) {
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
    <CollectionRow key={collection.id} addressId={addressId} collection={collection} index={index} tabsType={tabsType} onPressItem={onPressItem} />
  ));
};

export default NFTList;
