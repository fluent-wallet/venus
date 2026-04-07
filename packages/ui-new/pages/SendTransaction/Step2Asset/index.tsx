import ProhibitIcon from '@assets/icons/prohibit.svg';
import { BottomSheetHeader, type BottomSheetMethods } from '@components/BottomSheet';
import { BottomSheetFlashList } from '@components/BottomSheet/BottomSheetFlashList';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import { ASSET_TYPE } from '@core/types';
import { NftCollectionRow } from '@modules/AssetsList/NFTsList/NftCollectionRow';
import TokenItem from '@modules/AssetsList/TokensList/TokenItem';
import { useTabsController } from '@modules/AssetsTabs/hooks';
import { useTheme } from '@react-navigation/native';
import {
  type SendTransactionScreenProps,
  type SendTransactionStep2StackName,
  SendTransactionStep3StackName,
  SendTransactionStep4StackName,
} from '@router/configs';
import { useCurrentAddress } from '@service/account';
import { isValidAddress } from '@service/address';
import { useAddCustomToken, useAssetsOfCurrentAddress } from '@service/asset';
import type { INftCollection, INftItem } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { useNftCollectionsOfAddress } from '@service/nft';
import type { ListRenderItem } from '@shopify/flash-list';
import type { AssetInfo } from '@utils/assetInfo';
import { toAssetInfo } from '@utils/toAssetInfo';
import { escapeRegExp } from 'lodash-es';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';
import { AssetTabsPager } from './AssetTabsPager';

function filterNftCollectionsBySearch(collections: INftCollection[], value: string): INftCollection[] {
  const keyword = value.trim();
  if (!keyword) return [];

  const matcher = new RegExp(escapeRegExp(keyword), 'i');
  return collections.filter((collection) =>
    [collection.name, collection.symbol, collection.contractAddress].some((field) => (field ? matcher.test(String(field)) : false)),
  );
}

interface Props {
  navigation?: SendTransactionScreenProps<typeof SendTransactionStep2StackName>['navigation'];
  route?: SendTransactionScreenProps<typeof SendTransactionStep2StackName>['route'];
  onConfirm?: (asset: AssetInfo) => void;
  onClose?: () => void;
  selectType?: 'Send' | 'Receive';
}

type SearchResultItem =
  | {
      key: string;
      kind: 'token';
      asset: AssetInfo;
    }
  | {
      key: string;
      kind: 'nft-collection';
      collection: INftCollection;
      index: number;
    };

const SendTransactionStep2Asset: React.FC<Props> = ({ navigation, route, onConfirm, onClose, selectType = 'Send' }) => {
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods | null>(null);
  const { t } = useTranslation();
  const onlyToken = !navigation;

  const { currentTab, setCurrentTab, sharedScrollY, handleScroll: _handleScroll, resetScrollY } = useTabsController('Tokens');

  const handleScroll = useCallback(
    (evt: NativeSyntheticEvent<NativeScrollEvent>) => {
      _handleScroll(evt.nativeEvent.contentOffset.y);
    },
    [_handleScroll],
  );

  const currentNetworkQuery = useCurrentNetwork();
  const currentAddressQuery = useCurrentAddress();
  const currentNetwork = currentNetworkQuery.data;
  const currentAddress = currentAddressQuery.data;
  const currentAddressId = currentAddress?.id ?? '';
  const assetsQuery = useAssetsOfCurrentAddress();
  const addCustomToken = useAddCustomToken();
  const assets = assetsQuery.data ?? [];

  const [searchAsset, setSearchAsset] = useState(() => route?.params?.searchAddress ?? '');
  const [inFetchingRemote, setInFetchingRemote] = useState(false);
  const [filterAssets, setFilterAssets] = useState<{
    type: 'local' | 'remote' | 'invalid-format' | 'invalid-ERC20' | 'network-error';
    assets: Array<AssetInfo>;
  }>(() => ({ type: 'local', assets: [] }));

  const shouldEnableNftCollections = useMemo(() => {
    if (searchAsset.trim()) {
      return true;
    }

    return currentTab === 'NFTs';
  }, [currentTab, searchAsset]);

  const nftCollectionsQuery = useNftCollectionsOfAddress(currentAddressId, { enabled: shouldEnableNftCollections });
  const nftCollections = nftCollectionsQuery.data ?? [];
  const filteredNftCollections = useMemo(() => {
    return filterNftCollectionsBySearch(nftCollections, searchAsset);
  }, [nftCollections, searchAsset]);
  const searchResults = useMemo<SearchResultItem[]>(() => {
    const tokenResults = filterAssets.assets
      .filter((asset) => asset.type === ASSET_TYPE.ERC20 || asset.type === ASSET_TYPE.Native)
      .map((asset, index) => ({
        key: asset.type === ASSET_TYPE.Native ? `${ASSET_TYPE.Native}-${index}` : asset.contractAddress || `token-${index}`,
        kind: 'token' as const,
        asset,
      }));

    const nftResults = filteredNftCollections.map((collection, index) => ({
      key: collection.id,
      kind: 'nft-collection' as const,
      collection,
      index,
    }));

    return [...tokenResults, ...nftResults];
  }, [filterAssets.assets, filteredNftCollections]);

  const tokensLoading = assets.length === 0 && (currentAddressQuery.status === 'pending' || (Boolean(currentAddressId) && assetsQuery.status === 'pending'));
  const nftsLoading =
    nftCollections.length === 0 && (currentAddressQuery.status === 'pending' || (Boolean(currentAddressId) && nftCollectionsQuery.status === 'pending'));

  const searchFilterAssets = useCallback(
    async (value: string, isCancelled: () => boolean) => {
      if (!isCancelled()) {
        setInFetchingRemote(false);
      }

      const localAssets = assets
        ?.filter((asset) =>
          [asset.name, asset.symbol, asset.type === ASSET_TYPE.Native ? ASSET_TYPE.Native : asset.contractAddress].some((str) =>
            !str ? false : str.search(new RegExp(escapeRegExp(value), 'i')) !== -1,
          ),
        )
        .filter((asset) => !!asset.type)
        .filter((asset) => asset.type !== ASSET_TYPE.ERC1155 && asset.type !== ASSET_TYPE.ERC721)
        .map(toAssetInfo);

      if (localAssets && localAssets.length > 0) {
        if (!isCancelled()) {
          setFilterAssets({ type: 'local', assets: localAssets });
        }
        return;
      }

      const matchingNftCollections = filterNftCollectionsBySearch(nftCollections, value);
      if (matchingNftCollections.length > 0) {
        if (!isCancelled()) {
          setFilterAssets({ type: 'local', assets: [] });
        }
        return;
      }

      try {
        if (!currentNetwork || !currentAddressId) {
          if (!isCancelled()) {
            setFilterAssets({ type: 'network-error', assets: [] });
          }
          return;
        }

        const valid = isValidAddress({
          networkType: currentNetwork.networkType,
          addressValue: value,
        });

        if (valid) {
          if (!isCancelled()) {
            setInFetchingRemote(true);
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (isCancelled()) {
            return;
          }
          const created = await addCustomToken({ addressId: currentAddressId, contractAddress: value });
          if (isCancelled()) {
            return;
          }
          const assetInfo = toAssetInfo(created);
          setFilterAssets({ type: 'remote', assets: [assetInfo] });
        } else {
          if (!isCancelled()) {
            setFilterAssets({ type: 'invalid-format', assets: [] });
          }
        }
      } catch (err) {
        if (!isCancelled()) {
          if (String(err).includes('timed out')) {
            setFilterAssets({ type: 'network-error', assets: [] });
          } else {
            setFilterAssets({ type: 'invalid-ERC20', assets: [] });
          }
        }
      } finally {
        if (!isCancelled()) {
          setInFetchingRemote(false);
        }
      }
    },
    [assets, currentAddressId, currentNetwork, addCustomToken, nftCollections],
  );

  useEffect(() => {
    const keyword = searchAsset.trim();
    if (!keyword) {
      setInFetchingRemote(false);
      setFilterAssets((prev) => (prev.type === 'local' && prev.assets.length === 0 ? prev : { type: 'local', assets: [] }));
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void searchFilterAssets(keyword, () => cancelled);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchAsset, searchFilterAssets]);

  const handleClickAsset = useCallback(
    (asset: AssetInfo, nftItemDetail?: INftItem) => {
      if (navigation) {
        const recipientAddress = route?.params?.recipientAddress;
        if (!recipientAddress) {
          return;
        }
        if ((asset.type === ASSET_TYPE.ERC20 || asset.type === ASSET_TYPE.Native) && (Number(asset.balance) === 0 || Number.isNaN(Number(asset.balance)))) {
          return showMessage({
            message: t('tx.asset.zeroBalance', { symbol: asset.symbol }),
            type: 'warning',
          });
        }
        if (Keyboard.isVisible()) {
          Keyboard.dismiss();
        }
        if (asset.type === ASSET_TYPE.ERC721) {
          navigation.navigate(SendTransactionStep4StackName, {
            recipientAddress,
            asset,
            nftItemDetail,
            amount: '1',
          });
        } else {
          navigation.navigate(SendTransactionStep3StackName, {
            recipientAddress,
            asset,
            nftItemDetail,
          });
        }
        return;
      }

      if (onConfirm) {
        onConfirm(asset);
        setSearchAsset('');
        bottomSheetRef.current?.close();
      }
    },
    [navigation, onConfirm, route, t],
  );

  const renderSearchResultItem = useCallback<ListRenderItem<SearchResultItem>>(
    ({ item }) => {
      if (item.kind === 'token') {
        return (
          <TokenItem
            data={item.asset}
            showTypeLabel
            onPress={handleClickAsset}
            hidePrice={selectType === 'Receive'}
            hideBalance={selectType === 'Receive'}
            showAddress={selectType === 'Receive'}
          />
        );
      }

      return (
        <NftCollectionRow
          addressId={currentAddressId}
          collection={item.collection}
          index={item.index}
          showTypeLabel
          onSelect={(asset, nftItem) => handleClickAsset(asset, nftItem)}
        />
      );
    },
    [currentAddressId, handleClickAsset, selectType],
  );

  const renderSearchFooter = useCallback(() => {
    if (filterAssets.type === 'local' || filterAssets.type === 'remote') {
      return inFetchingRemote ? <HourglassLoading style={styles.fetchLoading} /> : null;
    }

    return (
      <>
        <Pressable
          style={({ pressed }) => [styles.invalidWrapper, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          disabled={filterAssets.type !== 'network-error'}
          testID="retry"
        >
          <ProhibitIcon style={styles.invalidIcon} width={24} height={24} />
          <Text style={[styles.invalidTip, { color: colors.down }]}>
            {filterAssets.type === 'invalid-format' && t('tx.asset.error.invalidFormat')}
            {filterAssets.type === 'invalid-ERC20' && t('tx.asset.error.invalidERC20')}
            {filterAssets.type === 'network-error' && (
              <Trans i18nKey={'tx.asset.error.networkError'}>
                Your Network is weak, <Text style={{ textDecorationLine: 'underline' }}>click to retry</Text>
              </Trans>
            )}
          </Text>
        </Pressable>
        {inFetchingRemote && <HourglassLoading style={styles.fetchLoading} />}
      </>
    );
  }, [colors.down, colors.underlay, filterAssets.type, inFetchingRemote, t]);

  return (
    <SendTransactionBottomSheet ref={bottomSheetRef} isRoute={!onConfirm} onClose={onClose} useBottomSheetView={false}>
      <BottomSheetHeader title={selectType === 'Receive' ? t('receive.title') : t('tx.send.title')}>
        <Text style={[styles.selectAsset, { color: colors.textSecondary }]}>{t('tx.asset.inputTitle')}</Text>
        <TextInput
          containerStyle={[styles.textinput, { borderColor: !!searchAsset && filterAssets.type.startsWith('invalid') ? colors.down : colors.borderFourth }]}
          showVisible={false}
          defaultHasValue={false}
          value={searchAsset}
          onChangeText={(newSearchAsset) => setSearchAsset(newSearchAsset)}
          isInBottomSheet
          placeholder={t('tx.asset.placeholder')}
        />
      </BottomSheetHeader>

      {!searchAsset && (
        <AssetTabsPager
          currentTab={currentTab}
          sharedScrollY={sharedScrollY}
          onlyToken={onlyToken}
          selectType={selectType}
          assets={assets}
          tokensLoading={tokensLoading}
          currentAddressId={currentAddressId}
          nftCollections={nftCollections}
          nftsLoading={nftsLoading}
          onTabChange={setCurrentTab}
          resetScrollY={resetScrollY}
          onScroll={handleScroll}
          onSelectAsset={handleClickAsset}
        />
      )}

      {searchAsset && (
        <BottomSheetFlashList
          data={searchResults}
          style={styles.scrollView}
          renderItem={renderSearchResultItem}
          keyExtractor={(item: SearchResultItem) => item.key}
          getItemType={(item: SearchResultItem) => item.kind}
          ListFooterComponent={renderSearchFooter}
          contentContainerStyle={styles.searchResultsContent}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SendTransactionBottomSheet>
  );
};

const styles = StyleSheet.create({
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

export default SendTransactionStep2Asset;
