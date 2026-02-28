import ProhibitIcon from '@assets/icons/prohibit.svg';
import { BottomSheetHeader, type BottomSheetMethods, BottomSheetScrollContent } from '@components/BottomSheet';
import HourglassLoading from '@components/Loading/Hourglass';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { AssetType, useAssetsAllList, useTokenListOfCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { NFTCollectionItem } from '@modules/AssetsList/NFTsList/NFTCollectionItem';
import { NFTItemsGrid } from '@modules/AssetsList/NFTsList/NFTItemsGrid';
import { useOpenNftCollection } from '@modules/AssetsList/NFTsList/openState';
import { SkeletoDetailItem } from '@modules/AssetsList/NFTsList/Skeleton';
import TokenItem from '@modules/AssetsList/TokensList/TokenItem';
import { TabsContent, TabsHeader } from '@modules/AssetsTabs';
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
import { useAddCustomToken } from '@service/asset';
import type { IAsset, INftCollection, INftItem } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { useNftCollectionsOfAddress, useNftItems } from '@service/nft';
import Decimal from 'decimal.js';
import { debounce, escapeRegExp } from 'lodash-es';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import SendTransactionBottomSheet from '../SendTransactionBottomSheet';

function toLegacyAssetInfo(asset: IAsset): AssetInfo {
  const decimals = typeof asset.decimals === 'number' ? asset.decimals : 18;
  const balance = asset.balance ? new Decimal(asset.balance) : new Decimal(0);
  const baseUnits = balance.mul(Decimal.pow(10, decimals)).toFixed(0);

  return {
    type: asset.type as unknown as AssetInfo['type'],
    contractAddress: asset.contractAddress ?? '',
    name: asset.name ?? '',
    symbol: asset.symbol ?? '',
    decimals,
    balance: baseUnits,
    icon: asset.icon ?? undefined,
    priceInUSDT: asset.priceInUSDT ?? undefined,
    priceValue: asset.priceValue ?? undefined,
  };
}

function toLegacyNftAssetInfo(params: {
  collection: Pick<INftCollection, 'contractAddress' | 'type' | 'name' | 'symbol' | 'icon'>;
  item: INftItem;
}): AssetInfo {
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

const DetailSkeleton: React.FC = memo(() => {
  const { colors } = useTheme();
  return (
    <View style={{ marginVertical: 4, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 56, paddingRight: 16, gap: 16 }}>
      {Array.from({ length: 2 }).map((_, index) => (
        <View
          key={index}
          style={{
            borderColor: colors.borderThird,
            borderWidth: 1,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingTop: 8,
            paddingBottom: 12,
          }}
        >
          <SkeletoDetailItem colors={colors} />
        </View>
      ))}
    </View>
  );
});

const NftSearchRow: React.FC<{
  addressId: string;
  index: number;
  collection: INftCollection;
  onSelect: (asset: AssetInfo, item: INftItem) => void;
}> = memo(({ addressId, index, collection, onSelect }) => {
  const [open, setOpen] = useOpenNftCollection();
  const isOpen = open?.contractAddress?.toLowerCase() === collection.contractAddress.toLowerCase();

  const { data: items = [], isFetching } = useNftItems({
    addressId,
    contractAddress: collection.contractAddress,
    enabled: isOpen,
  });

  return (
    <>
      <NFTCollectionItem
        collection={collection}
        isOpen={isOpen}
        onPress={() => {
          setOpen(isOpen ? null : { contractAddress: collection.contractAddress, index });
        }}
        showTypeLabel
      />
      {isOpen &&
        (isFetching && items.length === 0 ? (
          <DetailSkeleton />
        ) : (
          <NFTItemsGrid
            collection={collection}
            items={items}
            onPressItem={(item) => {
              onSelect(toLegacyNftAssetInfo({ collection, item }), item);
            }}
          />
        ))}
    </>
  );
});

interface Props {
  navigation?: SendTransactionScreenProps<typeof SendTransactionStep2StackName>['navigation'];
  route?: SendTransactionScreenProps<typeof SendTransactionStep2StackName>['route'];
  onConfirm?: (asset: AssetInfo) => void;
  onClose?: () => void;
  selectType?: 'Send' | 'Receive';
}

const SendTransactionStep2Asset: React.FC<Props> = ({ navigation, route, onConfirm, onClose, selectType = 'Send' }) => {
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const { t } = useTranslation();

  const { currentTab, setCurrentTab, sharedScrollY, handleScroll: _handleScroll, resetScrollY } = useTabsController('Tokens');

  const handleScroll = useCallback(
    (evt: NativeSyntheticEvent<NativeScrollEvent>) => {
      _handleScroll(evt.nativeEvent.contentOffset.y);
    },
    [_handleScroll],
  );

  const { data: currentNetwork } = useCurrentNetwork();
  const { data: currentAddress } = useCurrentAddress();
  const addCustomToken = useAddCustomToken();

  const assets = (selectType === 'Send' ? useAssetsAllList : useTokenListOfCurrentNetwork)();

  const [searchAsset, setSearchAsset] = useState(() => route?.params?.searchAddress ?? '');
  const [inFetchingRemote, setInFetchingRemote] = useState(false);
  const [filterAssets, setFilterAssets] = useState<{
    type: 'local' | 'remote' | 'invalid-format' | 'invalid-ERC20' | 'network-error';
    assets: Array<AssetInfo>;
  }>(() => ({ type: 'local', assets: [] }));

  const nftCollectionsQuery = useNftCollectionsOfAddress(currentAddress?.id ?? '');
  const filteredNftCollections = useMemo(() => {
    const value = searchAsset.trim();
    if (!value) return [];
    const re = new RegExp(escapeRegExp(value), 'i');
    return (nftCollectionsQuery.data ?? []).filter((c) => [c.name, c.symbol, c.contractAddress].some((s) => (s ? re.test(String(s)) : false)));
  }, [nftCollectionsQuery.data, searchAsset]);

  const searchFilterAssets = useCallback(
    debounce(async (value: string) => {
      const localAssets = assets
        ?.filter((asset) =>
          [asset.name, asset.symbol, asset.type === AssetType.Native ? AssetType.Native : asset.contractAddress].some((str) =>
            !str ? false : str?.search(new RegExp(escapeRegExp(value), 'i')) !== -1,
          ),
        )
        .filter((asset) => !!asset.type)
        .filter((asset) => asset.type !== AssetType.ERC1155 && asset.type !== AssetType.ERC721);
      if (localAssets && localAssets?.length > 0) {
        setFilterAssets({ type: 'local', assets: localAssets });
      } else {
        try {
          if (!currentNetwork || !currentAddress?.id) {
            setFilterAssets({ type: 'network-error', assets: [] });
            return;
          }

          const valid = isValidAddress({
            networkType: currentNetwork.networkType,
            addressValue: value!,
          });

          if (valid) {
            setInFetchingRemote(true);
            await new Promise((resolve) => setTimeout(() => resolve(null!)));
            const created = await addCustomToken({ addressId: currentAddress.id, contractAddress: value });
            const assetInfo = toLegacyAssetInfo(created);
            setFilterAssets({ type: 'remote', assets: [assetInfo] });
          } else {
            setFilterAssets({ type: 'invalid-format', assets: [] });
          }
        } catch (err) {
          if (String(err).includes('timed out')) {
            setFilterAssets({ type: 'network-error', assets: [] });
          } else {
            setFilterAssets({ type: 'invalid-ERC20', assets: [] });
          }
        } finally {
          setInFetchingRemote(false);
        }
      }
    }, 200),
    [assets, currentNetwork, currentAddress?.id, addCustomToken],
  );

  useEffect(() => {
    searchFilterAssets(searchAsset);
  }, [searchFilterAssets, searchAsset]);

  const handleClickAsset = useCallback((asset: AssetInfo, nftItemDetail?: INftItem) => {
    if (navigation) {
      if ((asset.type === AssetType.ERC20 || asset.type === AssetType.Native) && (Number(asset.balance) === 0 || Number.isNaN(Number(asset.balance)))) {
        return showMessage({
          message: t('tx.asset.zeroBalance', { symbol: asset.symbol }),
          type: 'warning',
        });
      }
      if (asset.type === AssetType.ERC721) {
        navigation.navigate(SendTransactionStep4StackName, { ...route!.params, asset, nftItemDetail, amount: '1' });
      } else {
        navigation.navigate(SendTransactionStep3StackName, { ...route!.params, asset, nftItemDetail });
      }
    } else if (onConfirm) {
      onConfirm(asset);
      setSearchAsset('');
      bottomSheetRef?.current?.close();
    }
  }, []);

  return (
    <SendTransactionBottomSheet ref={bottomSheetRef} isRoute={!onConfirm} onClose={onClose}>
      <BottomSheetHeader title={selectType === 'Receive' ? t('receive.title') : t('tx.send.title')}>
        <Text style={[styles.selectAsset, { color: colors.textSecondary }]}>{t('tx.asset.inputTitle')}</Text>
        <TextInput
          containerStyle={[
            styles.textinput,
            { borderColor: !!searchAsset && filterAssets?.type && filterAssets.type.startsWith('invalid') ? colors.down : colors.borderFourth },
          ]}
          showVisible={false}
          defaultHasValue={false}
          value={searchAsset}
          onChangeText={(newNickName) => setSearchAsset(newNickName)}
          isInBottomSheet
          placeholder={t('tx.asset.placeholder')}
          multiline
        />
      </BottomSheetHeader>

      {!searchAsset && (
        <BottomSheetScrollContent style={[styles.scrollView, { marginVertical: 16 }]} stickyHeaderIndices={[0]} onScroll={handleScroll}>
          <TabsHeader
            type="SelectAsset"
            currentTab={currentTab}
            onlyToken={!navigation}
            sharedScrollY={sharedScrollY}
            onTabChange={setCurrentTab}
            resetScrollY={resetScrollY}
          />

          <TabsContent
            type="SelectAsset"
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            selectType={selectType}
            onPressAsset={handleClickAsset}
            onlyToken={!navigation}
          />
        </BottomSheetScrollContent>
      )}
      {searchAsset && (
        <BottomSheetScrollContent style={styles.scrollView} onScroll={handleScroll}>
          {filterAssets.assets?.length > 0 &&
            filterAssets.assets.map((asset) => {
              const itemKey = asset.type === AssetType.Native ? AssetType.Native : asset.contractAddress;
              return asset.type === AssetType.ERC20 || asset.type === AssetType.Native ? (
                <TokenItem
                  key={itemKey}
                  data={asset}
                  showTypeLabel
                  onPress={handleClickAsset}
                  hidePrice={selectType === 'Receive'}
                  hideBalance={selectType === 'Receive'}
                  showAddress={selectType === 'Receive'}
                />
              ) : null;
            })}

          {filteredNftCollections.length > 0 &&
            filteredNftCollections.map((collection, index) => (
              <NftSearchRow
                key={collection.id}
                addressId={currentAddress?.id ?? ''}
                collection={collection}
                index={index}
                onSelect={(asset, item) => handleClickAsset(asset, item)}
              />
            ))}

          {filterAssets.type !== 'local' && filterAssets.type !== 'remote' && (
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
          )}
          {inFetchingRemote && <HourglassLoading style={styles.fetchLoading} />}
        </BottomSheetScrollContent>
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
