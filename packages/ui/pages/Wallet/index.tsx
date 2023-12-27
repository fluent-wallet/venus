import React, { useRef, useState } from 'react';
import { View, SafeAreaView, Pressable, RefreshControl, ScrollView } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Text, useTheme, Tab, TabView, Card } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { type StackNavigation, ReceiveAddressStackName, ReceiveStackName } from '@router/configs';
import TokenList from '@modules/AssetList/TokenList';
import ESpaceNFTList from '@modules/AssetList/ESpaceNFTList';
import ActivityList from '@modules/ActivityList';
import Skeleton from '@components/Skeleton';
import { useCurrentAccount, useCurrentNetwork, useAssetsTotalPriceValue } from '@core/WalletCore/Plugins/ReactInject';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';
import plugins from '@core/WalletCore/Plugins';
import { updateNFTDetail } from '@modules/AssetList/ESpaceNFTList/fetch';
import SendIcon from '@assets/icons/send.svg';
import ReceiveIcon from '@assets/icons/receive.svg';
import BuyIcon from '@assets/icons/buy.svg';
import MoreIcon from '@assets/icons/more.svg';
import WifiOffIcon from '@assets/icons/wifi_off.svg';
import SIMCardIcon from '@assets/icons/sim-card.svg';
import PullRefresh from '@components/PullRefresh';
import { numberWithCommas } from '@core/utils/balance';
import VisibilityIcon from '@assets/icons/visibility.svg';
import VisibilityOffIcon from '@assets/icons/visibility_off.svg';
import { useAtom } from 'jotai';
import TotalPriceVisibleAtom from '@hooks/useTotalPriceVisible';
import { UserAddress } from './WalletHeader';
import PagerView from 'react-native-pager-view';
import AsteriskIcon from '@assets/icons/asterisk.svg';

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

const Wallet: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  const { isConnected } = useNetInfo(); // init state is null
  const [totalPriceVisible, setTotalPriceVisible] = useAtom(TotalPriceVisibleAtom);
  const currentAccount = useCurrentAccount();
  const currentNetwork = useCurrentNetwork();
  const totalPriceValue = useAssetsTotalPriceValue();
  const [refreshing, setRefreshing] = React.useState(false);
  const [tabIndex, setTabIndex] = React.useState(0);
  const tabRef = useRef<PagerView>(null);

  const handleTabChange = (index: number) => {
    if (tabRef.current) {
      setTabIndex(index);
      tabRef.current.setPage(index);
    }
  };
  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <View className="absolute left-0 right-0 flex justify-center items-center z-50" style={{ top: statusBarHeight + 48 }}>
        {isConnected !== null && !isConnected && (
          <View style={{ backgroundColor: theme.colors.textSecondary }} className="rounded-lg p-3 flex flex-row items-center">
            <WifiOffIcon color={theme.colors.textInvert} width={20} height={20} />
            <Text className="ml-1" style={{ color: theme.colors.textInvert }}>
              No Internet Connection
            </Text>
          </View>
        )}
      </View>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ flexGrow: 1 }}
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
        <View className="px-[24px]">
          <View className="flex flex-row items-center justify-center mb-[3px]">
            <SIMCardIcon color={theme.colors.surfaceBrand} width={24} height={24} />
            <Text className="leading-normal" style={{ color: theme.colors.textBrand }}>
              {currentAccount?.nickname}
            </Text>
          </View>

          <View className="flex items-center justify-center h-[60px] mb-[2px]">
            {totalPriceValue === null ? (
              <Skeleton width={156} height={30} />
            ) : (
              <Pressable className="flex flex-row items-center" testID="toggleTotalPriceVisible" onPress={() => setTotalPriceVisible(!totalPriceVisible)}>
                <Text className="text-4xl font-bold">$</Text>
                {totalPriceVisible ? (
                  <Text className="text-4xl font-bold" numberOfLines={1}>
                    {numberWithCommas(totalPriceValue)}
                  </Text>
                ) : (
                  <View className="flex flex-row gap-1">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <AsteriskIcon key={index} color={theme.colors.textPrimary} width={12} height={12} />
                    ))}
                  </View>
                )}
                <View className=" self-start">
                  {totalPriceVisible ? (
                    <VisibilityIcon color={theme.colors.textSecondary} width={16} height={16} />
                  ) : (
                    <VisibilityOffIcon color={theme.colors.textSecondary} width={16} height={16} />
                  )}
                </View>
              </Pressable>
            )}
          </View>
          <View className="flex items-center justify-center mb-[23px]">
            <UserAddress />
          </View>

          <View className="flex flex-row justify-between mb-4">
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

        {/* {renderTabTitle()} */}
        <View className="flex flex-row px-6 gap-4" style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7 }}>
          {Array.from(
            currentNetwork && (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)
              ? ['Tokens', 'NFTs', 'Activity']
              : ['Tokens', 'Activity']
          ).map((item, index) => (
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
        <Card.Divider className="mb-[0px]" />
        <PagerView initialPage={tabIndex} ref={tabRef}>
          <View className="w-full h-full" key="0">
            <TokenList showReceive />
          </View>
          <View className="w-full h-full pb-2" key="1">
            <ESpaceNFTList />
          </View>
          <View className="w-full h-full pb-2" key="2">
            <ActivityList />
          </View>
        </PagerView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Wallet;
