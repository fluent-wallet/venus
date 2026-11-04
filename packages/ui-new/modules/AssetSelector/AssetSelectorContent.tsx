import ProhibitIcon from '@assets/icons/prohibit.svg';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import { NftCollectionRow } from '@modules/AssetsList/NFTsList/NftCollectionRow';
import TokenItem from '@modules/AssetsList/TokensList/TokenItem';
import { useTabsController } from '@modules/AssetsTabs/hooks';
import { useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { type AssetSearchItem, useAssetSearch } from '@service/assetSearch';
import type { IAsset, INftCollection, INftItem } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { useNftCollectionsOfAddress } from '@service/nft';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { AssetInfo } from '@utils/assetInfo';
import type React from 'react';
import { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AssetTabsPager } from './AssetTabsPager';

const EMPTY_ASSETS: IAsset[] = [];
const EMPTY_NFT_COLLECTIONS: INftCollection[] = [];

interface Props {
  selectType: 'Send' | 'Receive';
  initialSearch?: string;
  onSelectAsset: (asset: AssetInfo, nftItemDetail?: INftItem) => void;
}

const AssetSelectorContent: React.FC<Props> = ({ selectType, initialSearch = '', onSelectAsset }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isReceive = selectType === 'Receive';
  const [searchText, setSearchText] = useState(initialSearch);
  const isSearchMode = searchText.length > 0;
  const { currentTab, setCurrentTab, sharedScrollY, handleScroll: updateScrollY, resetScrollY } = useTabsController('Tokens');

  const { data: currentNetwork } = useCurrentNetwork();
  const { data: currentAddress, status: currentAddressStatus } = useCurrentAddress();
  const currentAddressId = currentAddress?.id ?? '';
  const { data: assets = EMPTY_ASSETS, status: assetsStatus } = useAssetsOfCurrentAddress();

  const shouldLoadNftCollections = searchText.trim().length > 0 || currentTab === 'NFTs';
  const { data: nftCollections = EMPTY_NFT_COLLECTIONS, status: nftCollectionsStatus } = useNftCollectionsOfAddress(currentAddressId, {
    enabled: shouldLoadNftCollections,
  });
  const tokensLoading = assets.length === 0 && (currentAddressStatus === 'pending' || (Boolean(currentAddressId) && assetsStatus === 'pending'));
  const nftsLoading = nftCollections.length === 0 && (currentAddressStatus === 'pending' || (Boolean(currentAddressId) && nftCollectionsStatus === 'pending'));
  const {
    items: searchResults,
    status: searchStatus,
    hasCompletedSearch,
  } = useAssetSearch({
    text: searchText,
    assets,
    nftCollections,
    network: currentNetwork,
    addressId: currentAddressId,
    isLoadingLocalAssets: tokensLoading || nftsLoading,
  });
  const showSearchResults = isSearchMode && hasCompletedSearch;
  const isSearchInvalid = isSearchMode && searchStatus.startsWith('invalid');

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateScrollY(event.nativeEvent.contentOffset.y);
    },
    [updateScrollY],
  );

  const handleSelectAsset = useCallback(
    (asset: AssetInfo, nftItemDetail?: INftItem) => {
      onSelectAsset(asset, nftItemDetail);
      if (isReceive) {
        setSearchText('');
      }
    },
    [onSelectAsset, isReceive],
  );

  const renderSearchResultItem = useCallback<ListRenderItem<AssetSearchItem>>(
    ({ item }) => {
      if (item.kind === 'token') {
        return <TokenItem data={item.asset} showTypeLabel onPress={handleSelectAsset} hidePrice={isReceive} hideBalance={isReceive} showAddress={isReceive} />;
      }

      return <NftCollectionRow addressId={currentAddressId} collection={item.collection} index={item.index} showTypeLabel onSelect={handleSelectAsset} />;
    },
    [currentAddressId, handleSelectAsset, isReceive],
  );

  const renderSearchFooter = useCallback(() => {
    if (searchStatus === 'searching') return <HourglassLoading style={styles.fetchLoading} />;
    if (searchStatus === 'idle' || searchStatus === 'ready') return null;

    return (
      <Pressable
        style={({ pressed }) => [styles.invalidWrapper, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        disabled={searchStatus !== 'network-error'}
        testID="retry"
      >
        <ProhibitIcon style={styles.invalidIcon} width={24} height={24} />
        <Text style={[styles.invalidTip, { color: colors.down }]}>
          {searchStatus === 'invalid-format' && t('tx.asset.error.invalidFormat')}
          {searchStatus === 'invalid-ERC20' && t('tx.asset.error.invalidERC20')}
          {searchStatus === 'network-error' && (
            <Trans i18nKey={'tx.asset.error.networkError'}>
              Your Network is weak, <Text style={{ textDecorationLine: 'underline' }}>click to retry</Text>
            </Trans>
          )}
        </Text>
      </Pressable>
    );
  }, [colors.down, colors.underlay, searchStatus, t]);

  return (
    <>
      <View style={styles.searchHeader}>
        <Text style={[styles.selectAsset, { color: colors.textSecondary }]}>{t('tx.asset.inputTitle')}</Text>
        <TextInput
          containerStyle={[styles.textinput, { borderColor: isSearchInvalid ? colors.down : colors.borderFourth }]}
          showVisible={false}
          defaultHasValue={false}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('tx.asset.placeholder')}
        />
      </View>

      {showSearchResults ? (
        <FlashList
          data={searchResults}
          style={styles.scrollView}
          renderItem={renderSearchResultItem}
          keyExtractor={(item: AssetSearchItem) => item.key}
          getItemType={(item: AssetSearchItem) => item.kind}
          ListFooterComponent={renderSearchFooter}
          contentContainerStyle={styles.searchResultsContent}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onScroll={handleListScroll}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <AssetTabsPager
          currentTab={currentTab}
          sharedScrollY={sharedScrollY}
          onlyToken={isReceive}
          selectType={selectType}
          assets={assets}
          tokensLoading={tokensLoading}
          currentAddressId={currentAddressId}
          nftCollections={nftCollections}
          nftsLoading={nftsLoading}
          onTabChange={setCurrentTab}
          resetScrollY={resetScrollY}
          onScroll={handleListScroll}
          onSelectAsset={handleSelectAsset}
        />
      )}
      {isSearchMode && !hasCompletedSearch && renderSearchFooter()}
    </>
  );
};

const styles = StyleSheet.create({
  searchHeader: {
    paddingBottom: 8,
  },
  selectAsset: {
    marginVertical: 16,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  textinput: {
    marginHorizontal: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  searchResultsContent: {
    paddingBottom: 16,
  },
  invalidWrapper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  invalidIcon: {
    marginRight: 4,
  },
  invalidTip: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  fetchLoading: {
    marginTop: 24,
    width: 60,
    height: 60,
    alignSelf: 'center',
  },
});

export default AssetSelectorContent;
