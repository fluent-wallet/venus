import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, SafeAreaView, Pressable, RefreshControl, ScrollView, StatusBar, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Text, useTheme, Card } from '@rneui/themed';
import { useFocusEffect } from '@react-navigation/native';
import clsx from 'clsx';
import { useAtom } from 'jotai';
import { statusBarHeight } from '@utils/deviceInfo';
import { useCurrentAccount, useCurrentNetwork, useAssetsTotalPriceValue, useVaultOfAccount } from '@core/WalletCore/Plugins/ReactInject';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';
import plugins from '@core/WalletCore/Plugins';
import { resetTransaction } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import { BackUpNoticeStackName, ReceiveAddressStackName, ReceiveStackName, type StackNavigation } from '@router/configs';
import { updateNFTDetail } from '@modules/AssetList/ESpaceNFTList/fetch';
import TokenList from '@modules/AssetList/TokenList';
import ESpaceNFTList from '@modules/AssetList/ESpaceNFTList';
import ActivityList from '@modules/ActivityList';
import NoNetwork from '@modules/NoNetwork';
import Skeleton from '@components/Skeleton';
import SendIcon from '@assets/icons/send.svg';
import ReceiveIcon from '@assets/icons/receive.svg';
import BuyIcon from '@assets/icons/buy.svg';
import MoreIcon from '@assets/icons/more.svg';
import SIMCardIcon from '@assets/icons/sim-card.svg';
import { numberWithCommas } from '@core/utils/balance';
import VisibilityIcon from '@assets/icons/visibility.svg';
import VisibilityOffIcon from '@assets/icons/visibility_off.svg';
import TotalPriceVisibleAtom from '@hooks/useTotalPriceVisible';
import AsteriskIcon from '@assets/icons/asterisk.svg';
import Background from '@modules/Background';
import WalletHeader, { UserAddress } from './WalletHeader';
import { USER_MNEMONIC_PHRASE_BACKUP_FEATURE } from '@utils/features';
import { Button } from '@rneui/base';
import VaultType from '@core/database/models/Vault/VaultType';
import VaultSourceType from '@core/database/models/Vault/VaultSourceType';

const MainButton: React.FC<{ onPress?: VoidFunction; disabled?: boolean; label?: string; icon?: React.ReactElement; _testID?: string }> = ({
  onPress,
  disabled,
  label,
  icon,
  _testID,
}) => {
  const { theme } = useTheme();
  return (
    <Pressable testID={_testID} className="flex items-center" onPress={!disabled ? onPress : undefined}>
      <View
        className="flex justify-center items-center w-[48px] h-[48px] rounded-full"
        style={{ backgroundColor: disabled ? theme.colors.surfaceSecondary : theme.colors.surfaceBrand }}
      >
        {icon}
      </View>
      <Text className="text-base font-medium" style={{ color: disabled ? theme.colors.textSecondary : theme.colors.textPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
};

const h = statusBarHeight + 192;
const Wallet: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();

  const [totalPriceVisible, setTotalPriceVisible] = useAtom(TotalPriceVisibleAtom);
  const currentAccount = useCurrentAccount();
  const currentNetwork = useCurrentNetwork();
  const vault = useVaultOfAccount(currentAccount?.id || '');
  const totalPriceValue = useAssetsTotalPriceValue();
  const [refreshing, setRefreshing] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const tabRef = useRef<PagerView>(null);
  const [, resetTX] = useAtom(resetTransaction);
  const handleTabChange = (index: number) => {
    if (tabRef.current) {
      setTabIndex(index);
      tabRef.current.setPage(index);
    }
  };

  const handlePageSelected = (index: number) => {
    if (index !== tabIndex) {
      setTabIndex(index);
    }
  };

  const [_, forceUpdate] = useState(0);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      forceUpdate((pre) => pre + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [navigation]);

  const [inSticky, setInSticky] = useState(false);
  const handleScroll = useCallback((evt: NativeSyntheticEvent<NativeScrollEvent>) => {
    setInSticky(evt.nativeEvent.contentOffset.y >= h);
  }, []);
  useFocusEffect(
    useCallback(() => {
      resetTX();
    }, [resetTX]),
  );

  const tabs = useMemo(
    () =>
      currentNetwork && (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)
        ? (['Tokens', 'NFTs', 'Activity'] as const)
        : (['Tokens', 'Activity'] as const),
    [currentNetwork],
  );

  return (
    <SafeAreaView className="flex-1" style={{ paddingTop: statusBarHeight + 44 }}>
      <StatusBar backgroundColor={inSticky ? theme.colors.pureBlackAndWight : 'transparent'} />
      <WalletHeader
        className="absolute top-0 left-0 z-[10] transition-colors"
        style={{ backgroundColor: inSticky ? theme.colors.pureBlackAndWight : 'transparent', top: statusBarHeight }}
      />
      <NoNetwork />
      <View className="absolute left-0  w-full z-0 pointer-events-none" style={{ top: -statusBarHeight, height: 360 + statusBarHeight }}>
        <Background contentClassName="w-full h-full" />
      </View>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={handleScroll}
        refreshControl={
          <RefreshControl
            colors={['#4572EC']}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              updateNFTDetail();
              plugins.AssetsTracker.updateCurrentTracker()
                .catch((err) => console.log(err))
                .finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <View style={{ paddingHorizontal: 24 }}>
          <View className="flex flex-row items-center justify-center mb-[3px]">
            <SIMCardIcon color={theme.colors.surfaceBrand} width={24} height={24} />
            <Text
              numberOfLines={1}
              className="leading-normal"
              style={{ color: theme.colors.textBrand, maxWidth: 170, opacity: currentAccount?.nickname ? 100 : 0 }}
            >
              {currentAccount?.nickname ?? 'placeholder'}
            </Text>
          </View>

          <View className="flex items-center justify-center h-[60px] mb-[2px]">
            {totalPriceValue === null ? (
              <Skeleton width={156} height={30} />
            ) : (
              <Pressable className="flex flex-row items-center" testID="toggleTotalPriceVisible" onPress={() => setTotalPriceVisible(!totalPriceVisible)}>
                <Text className="text-4xl font-bold">$</Text>
                {totalPriceVisible ? (
                  <Text className="text-4xl font-bold" numberOfLines={1} style={{ maxWidth: 326 }}>
                    {numberWithCommas(totalPriceValue)}
                  </Text>
                ) : (
                  <View className="flex flex-row gap-1">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <AsteriskIcon key={index} color={theme.colors.textPrimary} width={12} height={12} />
                    ))}
                  </View>
                )}
                <View className="ml-[4px]">
                  {totalPriceVisible ? (
                    <VisibilityIcon color={theme.colors.textSecondary} width={24} height={24} />
                  ) : (
                    <VisibilityOffIcon color={theme.colors.textSecondary} width={24} height={24} />
                  )}
                </View>
              </Pressable>
            )}
          </View>
          <View className="flex items-center justify-center mb-[24px]">
            <UserAddress />
          </View>

          <View className="flex flex-row justify-between mb-[12px]">
            <MainButton
              _testID="send"
              onPress={() => navigation.navigate(ReceiveAddressStackName, {})}
              icon={<SendIcon color="#fff" width={24} height={24} />}
              label="Send"
            />
            <MainButton
              _testID="receive"
              onPress={() => navigation.navigate(ReceiveStackName)}
              icon={<ReceiveIcon color="#fff" width={24} height={24} />}
              label="Receive"
            />
            <MainButton _testID="buy" icon={<BuyIcon color="#fff" width={24} height={24} />} label="Buy" disabled />
            <MainButton _testID="more" icon={<MoreIcon color="#fff" width={24} height={24} />} label="More" disabled />
          </View>
        </View>

        {USER_MNEMONIC_PHRASE_BACKUP_FEATURE.allow &&
          vault &&
          vault.type === VaultType.HierarchicalDeterministic &&
          !vault.isBackup &&
          vault.source === VaultSourceType.CREATE_BY_WALLET && (
            <View className="flex items-start  px-6 py-3">
              <Text className="">Protect your wallet by backing it up</Text>
              <Button testID="backUp" type="clear" buttonStyle={{ paddingLeft: 0 }} onPress={() => navigation.navigate(BackUpNoticeStackName)}>
                <Text>Back up {'>'}</Text>
              </Button>
            </View>
          )}

        <View className="flex flex-row px-6 gap-4" style={{ backgroundColor: inSticky ? theme.colors.pureBlackAndWight : 'transparent' }}>
          {tabs.map((item, index) => (
            <Pressable testID={item} key={index} onPress={() => handleTabChange(index)}>
              <Text
                className="leading-snug p-2"
                style={{
                  color: index === tabIndex ? theme.colors.surfaceBrand : theme.colors.textSecondary,
                  borderBottomWidth: 1,
                  borderBottomColor: index === tabIndex ? theme.colors.surfaceBrand : 'transparent',
                }}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <Card.Divider className="mb-[0px]" color={theme.colors.borderPrimary} />
        <PagerView style={{ flex: 1 }} initialPage={tabIndex} ref={tabRef} onPageSelected={(e) => handlePageSelected(+e.nativeEvent.position)}>
          {tabs?.map((tab, index) => (
            <View className="w-full h-full flex-1 min-h-[500px]" style={{ backgroundColor: theme.colors.surfacePrimary }} key={index}>
              {tab === 'Tokens' && index === tabIndex && (
                <View className={clsx('w-full h-full flex-1 pb-[8px] pt-[16px] px-[16px]', index !== tabIndex && 'display-none')}>
                  <TokenList showReceive />
                </View>
              )}
              {tab === 'NFTs' && index === tabIndex && (
                <View className={clsx('w-full h-full flex-1 pb-[8px] pt-[16px] px-[16px]', index !== tabIndex && 'display-none')}>
                  <ESpaceNFTList />
                </View>
              )}
              {tab === 'Activity' && index === tabIndex && (
                <View className={clsx('w-full h-full flex-1 pb-[8px] pt-[16px] px-[16px]', index !== tabIndex && 'display-none')}>
                  <ActivityList />
                </View>
              )}
            </View>
          ))}
        </PagerView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Wallet;
