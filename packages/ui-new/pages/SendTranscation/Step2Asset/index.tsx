import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useTheme } from '@react-navigation/native';
import PagerView from 'react-native-pager-view';
import { showMessage } from 'react-native-flash-message';
import { debounce, escapeRegExp } from 'lodash-es';
import { useAssetsAllList, useCurrentNetwork, useCurrentAddressValue, useCurrentAddress, useCurrentOpenNFTDetail, AssetType } from '@core/WalletCore/Plugins/ReactInject';
import { fetchERC20AssetInfoBatchWithAccount } from '@core/WalletCore/Plugins/AssetsTracker/fetchers/basic';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { type NFTItemDetail } from '@core/WalletCore/Plugins/NFTDetailTracker';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import HourglassLoading from '@components/Loading/Hourglass';
import { BottomSheetScrollView } from '@components/BottomSheet';
import { SendTranscationStep2StackName, SendTransactionStep3StackName, type SendTransactionScreenProps } from '@router/configs';
import { Tabs, TabsContent, setSendScrollY, type Tab } from '@modules/AssetsTabs';
import TokenItem from '@modules/AssetsList/TokensList/TokenItem';
import NFTItem from '@modules/AssetsList/NFTsList/NFTItem';

import BackupBottomSheet from '../SendTranscationBottomSheet';

const SendTranscationStep2Asset: React.FC<SendTransactionScreenProps<typeof SendTranscationStep2StackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();

  const [currentTab, setCurrentTab] = useState<Tab>('Tokens');
  const pageViewRef = useRef<PagerView>(null);
  const handleScroll = useCallback((evt: NativeSyntheticEvent<NativeScrollEvent>) => {
    setSendScrollY(evt.nativeEvent.contentOffset.y);
  }, []);

  const currentNetwork = useCurrentNetwork()!;
  const currentAddress = useCurrentAddress();
  const currentAddressValue = useCurrentAddressValue();
  const currentOpenNFTDetail = useCurrentOpenNFTDetail();
  const assets = useAssetsAllList();

  const [searchAsset, setSearchAsset] = useState('');
  const [inFetchingRemote, setInFetchingRemote] = useState(false);
  const [filterAssets, setFilterAssets] = useState<{
    type: 'local' | 'remote' | 'invalid-format' | 'invalid-ERC20' | 'network-error';
    assets: Array<AssetInfo>;
  }>(() => ({ type: 'local', assets: [] }));

  const searchFilterAssets = useCallback(
    debounce(async (value: string) => {
      if (value) {
        plugins.NFTDetailTracker.setCurrentOpenNFT(undefined);
      }

      const localAssets = assets?.filter((asset) =>
        [asset.name, asset.symbol, asset.type === AssetType.Native ? AssetType.Native : asset.contractAddress].some(
          (str) => str?.search(new RegExp(escapeRegExp(value), 'i')) !== -1,
        ),
      );
      if (localAssets && localAssets?.length > 0) {
        setFilterAssets({ type: 'local', assets: localAssets });
      } else {
        try {
          const isValidAddress = methods.checkIsValidAddress({
            networkType: currentNetwork.networkType,
            addressValue: value!,
          });

          if (isValidAddress) {
            setInFetchingRemote(true);
            await new Promise((resolve) => setTimeout(() => resolve(null!)));
            const remoteAsset = await fetchERC20AssetInfoBatchWithAccount({
              networkType: currentNetwork.networkType,
              endpoint: currentNetwork?.endpoint,
              contractAddress: value,
              accountAddress: currentAddress!,
            });
            setFilterAssets({ type: 'remote', assets: [{ ...remoteAsset, type: AssetType.ERC20, contractAddress: value }] });
          } else {
            setFilterAssets({ type: 'invalid-format', assets: [] });
          }
        } catch (err) {
          console.log(err);
          if (String(err).includes('timed out')) {
            setFilterAssets({ type: 'network-error', assets: [] });
          } else {
            setFilterAssets({ type: 'invalid-ERC20', assets: [] });
          }
        } finally {
          setInFetchingRemote(false);
        }
      }
    }, 500),
    [assets, currentNetwork, currentAddressValue],
  );

  useEffect(() => {
    searchFilterAssets(searchAsset);
  }, [searchFilterAssets, searchAsset]);

  const handleClickAsset = useCallback((asset: AssetInfo, nftItemDetail?: NFTItemDetail) => {
    if (asset.type === AssetType.ERC20 && (asset.balance === '0' || asset.balance === '0x')) {
      return showMessage({
        message: `The balance of asset ${asset.name} is 0`,
        type: 'warning',
      });
    }
    navigation.navigate(SendTransactionStep3StackName, { ...route.params, asset, nftItemDetail });
  }, []);

  return (
    <BackupBottomSheet onClose={navigation.goBack}>
      <Text style={[styles.selectAsset, { color: colors.textSecondary }]}>Select an asset</Text>
      <TextInput
        containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
        showVisible={false}
        defaultHasValue={false}
        value={searchAsset}
        onChangeText={(newNickName) => setSearchAsset(newNickName?.trim())}
        isInBottomSheet
        placeholder="Enter an asset name or address"
        multiline
      />

      {!searchAsset && (
        <BottomSheetScrollView style={styles.scrollView} stickyHeaderIndices={[0]} onScroll={handleScroll}>
          <Tabs currentTab={currentTab} pageViewRef={pageViewRef} type="SendTranscation" />
          <TabsContent currentTab={currentTab} setCurrentTab={setCurrentTab} pageViewRef={pageViewRef} type="SendTranscation" onPressItem={handleClickAsset} />
        </BottomSheetScrollView>
      )}
      {searchAsset && (
        <BottomSheetScrollView style={[styles.scrollView, { marginTop: 8 }]} onScroll={handleScroll}>
          {filterAssets.assets?.length > 0 &&
            filterAssets.assets.map((asset) =>
              asset.type === AssetType.ERC20 || asset.type === AssetType.Native ? (
                <TokenItem key={asset.contractAddress ?? AssetType.Native} data={asset} showTypeLabel onPress={handleClickAsset} />
              ) : (
                <NFTItem
                  key={asset.contractAddress}
                  data={asset}
                  currentOpenNFTDetail={currentOpenNFTDetail}
                  tabsType="SendTranscation"
                  showTypeLabel
                  onPress={handleClickAsset}
                />
              ),
            )}

          {filterAssets.type !== 'local' && filterAssets.type !== 'remote' && (
            <Pressable
              style={({ pressed }) => [{ backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              disabled={filterAssets.type !== 'network-error'}
            >
              <Text style={[styles.invalidTip, { color: colors.textPrimary }]}>
                🚫{'   '}
                {filterAssets.type === 'invalid-format' && 'Invalid contract address format'}
                {filterAssets.type === 'invalid-ERC20' && 'Only valid ERC20 token search is supported'}
                {filterAssets.type === 'network-error' && (
                  <>
                    Network error, <Text style={{ textDecorationLine: 'underline' }}>click to retry</Text>
                  </>
                )}
              </Text>
            </Pressable>
          )}
          {inFetchingRemote && <HourglassLoading style={styles.fetchLoading} />}
        </BottomSheetScrollView>
      )}
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  selectAsset: {
    marginTop: 24,
    marginBottom: 16,
    marginLeft: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
    marginVertical: 16,
  },
  invalidTip: {
    paddingHorizontal: 32,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 16,
  },
  fetchLoading: {
    marginTop: 24,
    width: 60,
    height: 60,
    alignSelf: 'center',
  },
  textinput: {
    marginHorizontal: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});

export default SendTranscationStep2Asset;
