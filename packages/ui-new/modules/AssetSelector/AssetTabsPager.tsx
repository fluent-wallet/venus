import NoneNFT from '@assets/images/none-NFT.webp';
import NoneToken from '@assets/images/none-token.webp';
import Text from '@components/Text';
import { ASSET_TYPE } from '@core/types';
import { NftListRow } from '@modules/AssetsList/NFTsList/NftListRow';
import { SkeletonList as NftSkeletonList } from '@modules/AssetsList/NFTsList/Skeleton';
import { type NftListRowData, useNftList } from '@modules/AssetsList/NFTsList/useNftList';
import { getTokenItemKey, hasPositiveTokenBalance } from '@modules/AssetsList/TokensList/helpers';
import { styles as emptyStyles } from '@modules/AssetsList/TokensList/ReceiveFunds';
import TokenSkeleton from '@modules/AssetsList/TokensList/Skeleton';
import TokenItem from '@modules/AssetsList/TokensList/TokenItem';
import { TabsHeader } from '@modules/AssetsTabs';
import { useTabs } from '@modules/AssetsTabs/hooks';
import type { TabType } from '@modules/AssetsTabs/types';
import { useIsFocused, useTheme } from '@react-navigation/native';
import type { IAsset, INftCollection, INftItem } from '@service/core';
import type { NftListState } from '@service/nft';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { AssetInfo } from '@utils/assetInfo';
import { toAssetInfo } from '@utils/toAssetInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { type SceneRendererProps, TabView } from 'react-native-tab-view';

interface AssetTabRoute {
  key: TabType;
}

const TAB_LIST_CONTENT_CONTAINER = { paddingBottom: 16 };
const maintainVisibleContentPosition = { disabled: true };
const getNftItemType = (row: NftListRowData) => row.kind;

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
}> = memo(({ assets, isLoading, selectType, onPressItem }) => {
  const tokens = useMemo(() => assets.filter((asset) => asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20).map(toAssetInfo), [assets]);

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
    <FlashList
      data={tokens}
      style={styles.list}
      renderItem={renderItem}
      keyExtractor={getTokenItemKey}
      contentContainerStyle={TAB_LIST_CONTENT_CONTAINER}
      getItemType={() => 'token'}
      removeClippedSubviews={Platform.OS === 'android'}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    />
  );
});

const NftsTabPage: React.FC<{
  collections: INftCollection[];
  nftListState: NftListState;
  isLoading: boolean;
  isActive: boolean;
  onPressItem: (asset: AssetInfo, item: INftItem) => void;
}> = memo(({ collections, nftListState, isLoading, isActive, onPressItem }) => {
  const { rows, stickyHeaderIndices, onPressCollection, onViewableItemsChanged, viewabilityConfig } = useNftList(nftListState, collections, {
    enabled: isActive,
  });
  const renderItem = useCallback(
    ({ item }: { item: NftListRowData }) => <NftListRow row={item} onPressCollection={onPressCollection} onSelect={onPressItem} />,
    [onPressCollection, onPressItem],
  );

  if (isLoading) {
    return <NftSkeletonList />;
  }

  if (!collections.length) {
    return <NftEmptyState />;
  }

  return (
    <FlashList
      data={rows}
      style={styles.list}
      renderItem={renderItem}
      keyExtractor={(item) => item.key}
      getItemType={getNftItemType}
      stickyHeaderIndices={stickyHeaderIndices}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      contentContainerStyle={TAB_LIST_CONTENT_CONTAINER}
      maintainVisibleContentPosition={maintainVisibleContentPosition}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    />
  );
});

export const AssetTabsPager: React.FC<{
  currentTab: TabType;
  onlyToken: boolean;
  selectType: 'Send' | 'Receive';
  assets: IAsset[];
  tokensLoading: boolean;
  nftCollections: INftCollection[];
  nftListState: NftListState;
  nftsLoading: boolean;
  onTabChange: (tab: TabType) => void;
  onSelectAsset: (asset: AssetInfo, nftItemDetail?: INftItem) => void;
}> = memo(({ currentTab, onlyToken, selectType, assets, tokensLoading, nftCollections, nftListState, nftsLoading, onTabChange, onSelectAsset }) => {
  const tabs = useTabs('SelectAsset', onlyToken);
  const isFocused = useIsFocused();
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
          return <TokensTabPage assets={assets} isLoading={tokensLoading} selectType={selectType} onPressItem={onSelectAsset} />;
        case 'NFTs':
          return (
            <NftsTabPage
              collections={nftCollections}
              nftListState={nftListState}
              isLoading={nftsLoading}
              isActive={isFocused && currentTab === 'NFTs'}
              onPressItem={onSelectAsset}
            />
          );
        default:
          return null;
      }
    },
    [assets, currentTab, isFocused, nftCollections, nftListState, nftsLoading, onSelectAsset, selectType, tokensLoading],
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
    ({ position }: SceneRendererProps) => (
      <View style={styles.headerLayer}>
        <TabsHeader type="SelectAsset" currentTab={currentTab} onlyToken={onlyToken} pagerPosition={position} onTabChange={onTabChange} />
      </View>
    ),
    [currentTab, onTabChange, onlyToken],
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
});

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
