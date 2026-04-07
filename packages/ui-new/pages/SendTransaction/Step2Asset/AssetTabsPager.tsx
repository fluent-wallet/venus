import NoneNFT from '@assets/images/none-NFT.webp';
import NoneToken from '@assets/images/none-token.webp';
import { BottomSheetFlatList } from '@components/BottomSheet';
import { BottomSheetFlashList } from '@components/BottomSheet/BottomSheetFlashList';
import Text from '@components/Text';
import { ASSET_TYPE } from '@core/types';
import { NftCollectionRow } from '@modules/AssetsList/NFTsList/NftCollectionRow';
import { SkeletonList as NftSkeletonList } from '@modules/AssetsList/NFTsList/Skeleton';
import { getTokenItemKey, hasPositiveTokenBalance } from '@modules/AssetsList/TokensList/helpers';
import { styles as emptyStyles } from '@modules/AssetsList/TokensList/ReceiveFunds';
import TokenSkeleton from '@modules/AssetsList/TokensList/Skeleton';
import TokenItem from '@modules/AssetsList/TokensList/TokenItem';
import { TabsHeader } from '@modules/AssetsTabs';
import { useTabs } from '@modules/AssetsTabs/hooks';
import type { TabType } from '@modules/AssetsTabs/types';
import { useTheme } from '@react-navigation/native';
import type { IAsset, INftCollection, INftItem } from '@service/core';
import type { ListRenderItem } from '@shopify/flash-list';
import type { AssetInfo } from '@utils/assetInfo';
import { toAssetInfo } from '@utils/toAssetInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type NativeScrollEvent, type NativeSyntheticEvent, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { TabView } from 'react-native-tab-view';

interface AssetTabRoute {
  key: TabType;
}

const TAB_LIST_CONTENT_CONTAINER = { paddingBottom: 16 };

function isAssetInfo(asset: AssetInfo | null): asset is AssetInfo {
  return asset !== null;
}

const TokenEmptyState: React.FC = memo(() => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Image style={emptyStyles.noneImg} source={NoneToken} contentFit="contain" />
      <Text style={[emptyStyles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noToken')}</Text>
    </>
  );
});

const NftEmptyState: React.FC = memo(() => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Image style={emptyStyles.noneImg} source={NoneNFT} contentFit="contain" />
      <Text style={[emptyStyles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noNFT')}</Text>
    </>
  );
});

const TokensTabPage: React.FC<{
  assets: IAsset[];
  isLoading: boolean;
  selectType: 'Send' | 'Receive';
  onPressItem: (asset: AssetInfo) => void;
  onScroll: (evt: NativeSyntheticEvent<NativeScrollEvent>) => void;
}> = memo(({ assets, isLoading, selectType, onPressItem, onScroll }) => {
  const tokens = useMemo(
    () =>
      assets
        .filter((asset) => asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20)
        .map(toAssetInfo)
        .filter(isAssetInfo),
    [assets],
  );

  const isTokensEmpty = useMemo(() => {
    if (tokens.length === 0) return true;
    return tokens.every((token) => !hasPositiveTokenBalance(token));
  }, [tokens]);

  const renderItem = useCallback<ListRenderItem<AssetInfo>>(
    ({ item }) => (
      <TokenItem
        hidePrice={selectType === 'Receive'}
        hideBalance={selectType === 'Receive'}
        showAddress={selectType === 'Receive'}
        data={item}
        onPress={onPressItem}
      />
    ),
    [onPressItem, selectType],
  );

  if (isLoading) {
    return <TokenSkeleton />;
  }

  if (selectType !== 'Receive' && isTokensEmpty) {
    return <TokenEmptyState />;
  }

  return (
    <BottomSheetFlashList
      data={tokens}
      style={styles.list}
      renderItem={renderItem}
      keyExtractor={getTokenItemKey}
      contentContainerStyle={TAB_LIST_CONTENT_CONTAINER}
      getItemType={() => 'token'}
      removeClippedSubviews={Platform.OS === 'android'}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      showsVerticalScrollIndicator={false}
    />
  );
});

const NftsTabPage: React.FC<{
  addressId: string;
  collections: INftCollection[];
  isLoading: boolean;
  onPressItem: (asset: AssetInfo, item: INftItem) => void;
  onScroll: (evt: NativeSyntheticEvent<NativeScrollEvent>) => void;
}> = memo(({ addressId, collections, isLoading, onPressItem, onScroll }) => {
  const renderItem = useCallback(
    ({ item, index }: { item: INftCollection; index: number }) => (
      <NftCollectionRow addressId={addressId} collection={item} index={index} onSelect={onPressItem} />
    ),
    [addressId, onPressItem],
  );

  if (isLoading) {
    return <NftSkeletonList />;
  }

  if (!collections.length) {
    return <NftEmptyState />;
  }

  return (
    <BottomSheetFlatList
      data={collections}
      style={styles.list}
      renderItem={renderItem}
      keyExtractor={(item: INftCollection) => item.id}
      contentContainerStyle={TAB_LIST_CONTENT_CONTAINER}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={onScroll}
      showsVerticalScrollIndicator={false}
    />
  );
});

export const AssetTabsPager: React.FC<{
  currentTab: TabType;
  sharedScrollY: SharedValue<number>;
  onlyToken: boolean;
  selectType: 'Send' | 'Receive';
  assets: IAsset[];
  tokensLoading: boolean;
  currentAddressId: string;
  nftCollections: INftCollection[];
  nftsLoading: boolean;
  onTabChange: (tab: TabType) => void;
  resetScrollY: () => void;
  onScroll: (evt: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onSelectAsset: (asset: AssetInfo, nftItemDetail?: INftItem) => void;
}> = memo(
  ({
    currentTab,
    sharedScrollY,
    onlyToken,
    selectType,
    assets,
    tokensLoading,
    currentAddressId,
    nftCollections,
    nftsLoading,
    onTabChange,
    resetScrollY,
    onScroll,
    onSelectAsset,
  }) => {
    const tabs = useTabs('SelectAsset', onlyToken);
    const { width } = useWindowDimensions();
    const routes = useMemo<AssetTabRoute[]>(() => tabs.map((tab) => ({ key: tab })), [tabs]);
    const currentIndex = useMemo(() => {
      const index = tabs.indexOf(currentTab);
      return index === -1 ? 0 : index;
    }, [currentTab, tabs]);

    useEffect(() => {
      const fallbackTab = tabs[0];
      if (fallbackTab && !tabs.includes(currentTab)) {
        onTabChange(fallbackTab);
      }
    }, [currentTab, onTabChange, tabs]);

    const renderTabPage = useCallback(
      (route: AssetTabRoute) => {
        switch (route.key) {
          case 'Tokens':
            return <TokensTabPage assets={assets} isLoading={tokensLoading} selectType={selectType} onPressItem={onSelectAsset} onScroll={onScroll} />;
          case 'NFTs':
            return (
              <NftsTabPage addressId={currentAddressId} collections={nftCollections} isLoading={nftsLoading} onPressItem={onSelectAsset} onScroll={onScroll} />
            );
          default:
            return null;
        }
      },
      [assets, currentAddressId, nftCollections, nftsLoading, onScroll, onSelectAsset, selectType, tokensLoading],
    );
    const handleIndexChange = useCallback(
      (index: number) => {
        const nextTab = tabs[index];
        if (nextTab) {
          onTabChange(nextTab);
        }
      },
      [onTabChange, tabs],
    );
    const renderTabBar = useCallback(
      () => (
        <View style={styles.headerLayer}>
          <TabsHeader
            type="SelectAsset"
            currentTab={currentTab}
            onlyToken={onlyToken}
            sharedScrollY={sharedScrollY}
            onTabChange={onTabChange}
            resetScrollY={resetScrollY}
          />
        </View>
      ),
      [currentTab, onTabChange, onlyToken, resetScrollY, sharedScrollY],
    );

    return (
      <View style={styles.tabsWrapper}>
        <TabView
          navigationState={{ index: currentIndex, routes }}
          onIndexChange={handleIndexChange}
          renderScene={({ route }) => renderTabPage(route)}
          renderTabBar={renderTabBar}
          initialLayout={{ width }}
          lazy={false}
          overScrollMode="never"
          style={styles.pagerView}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  tabsWrapper: {
    flex: 1,
    marginVertical: 16,
    overflow: 'visible',
  },
  headerLayer: {
    position: 'relative',
    zIndex: 10,
    elevation: 10,
    overflow: 'visible',
  },
  pagerView: {
    flex: 1,
  },
  pagerPage: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
});
