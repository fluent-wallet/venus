import ProhibitIcon from '@assets/icons/prohibit.svg';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import { ASSET_TYPE } from '@core/types';
import type { TabType } from '@modules/AssetsTabs/types';
import { useIsFocused, useTheme } from '@react-navigation/native';
import { useCurrentAddress } from '@service/account';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { useAssetSearch } from '@service/assetSearch';
import type { IAsset, INftCollection, INftItem } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { useNftCollectionsOfAddress, useNftListState } from '@service/nft';
import type { AssetInfo } from '@utils/assetInfo';
import type React from 'react';
import { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { AssetSearchResults } from './AssetSearchResults';
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
  const isFocused = useIsFocused();
  const isReceive = selectType === 'Receive';
  const [searchText, setSearchText] = useState(initialSearch);
  const isSearchMode = searchText.length > 0;
  const [currentTab, setCurrentTab] = useState<TabType>('Tokens');

  const { data: currentNetwork } = useCurrentNetwork();
  const { data: currentAddress, status: currentAddressStatus } = useCurrentAddress();
  const currentAddressId = currentAddress?.id ?? '';
  const nftListState = useNftListState(currentAddressId);
  const { data: assets = EMPTY_ASSETS, status: assetsStatus } = useAssetsOfCurrentAddress();

  const shouldLoadNftCollections = !isReceive && (searchText.trim().length > 0 || currentTab === 'NFTs');
  const { data: nftCollections = EMPTY_NFT_COLLECTIONS, status: nftCollectionsStatus } = useNftCollectionsOfAddress(currentAddressId, {
    enabled: shouldLoadNftCollections && isFocused,
  });
  const tokensLoading = assets.length === 0 && (currentAddressStatus === 'pending' || (Boolean(currentAddressId) && assetsStatus === 'pending'));
  const nftsLoading =
    !isReceive && nftCollections.length === 0 && (currentAddressStatus === 'pending' || (Boolean(currentAddressId) && nftCollectionsStatus === 'pending'));
  const {
    items: searchResults,
    status: searchStatus,
    hasCompletedSearch,
  } = useAssetSearch({
    text: searchText,
    assets,
    nftCollections,
    includeNfts: !isReceive,
    network: currentNetwork,
    addressId: currentAddressId,
    isLoadingLocalAssets: tokensLoading || nftsLoading,
  });
  const showSearchResults = isSearchMode && hasCompletedSearch;
  const isSearchInvalid = isSearchMode && searchStatus.startsWith('invalid');

  const handleSelectAsset = useCallback(
    (asset: AssetInfo, nftItemDetail?: INftItem) => {
      if (isReceive && asset.type !== ASSET_TYPE.Native && asset.type !== ASSET_TYPE.ERC20) return;
      onSelectAsset(asset, nftItemDetail);
      if (isReceive) {
        setSearchText('');
      }
    },
    [onSelectAsset, isReceive],
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
        <AssetSearchResults
          items={searchResults}
          nftListState={nftListState}
          isReceive={isReceive}
          onSelect={handleSelectAsset}
          renderFooter={renderSearchFooter}
        />
      ) : (
        <AssetTabsPager
          currentTab={currentTab}
          onlyToken={isReceive}
          selectType={selectType}
          assets={assets}
          tokensLoading={tokensLoading}
          nftCollections={nftCollections}
          nftListState={nftListState}
          nftsLoading={nftsLoading}
          onTabChange={setCurrentTab}
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
