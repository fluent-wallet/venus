import React, { useState } from 'react';
import { View, SafeAreaView, Pressable } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Text, useTheme, Tab, TabView } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { type StackNavigation, ReceiveAddressStackName, ReceiveStackName } from '@router/configs';
import TokenList from '@modules/AssetList/TokenList';
import ESpaceNFTList from '@modules/AssetList/ESpaceNFTList';
import ActivityList from '@modules/ActivityList';
import Skeleton from '@components/Skeleton';
import { useCurrentAccount, useCurrentNetwork, useAssetsTotalPriceValue } from '@core/WalletCore/Plugins/ReactInject';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';
import SendIcon from '@assets/icons/send.svg';
import ReceiveIcon from '@assets/icons/receive.svg';
import BuyIcon from '@assets/icons/buy.svg';
import MoreIcon from '@assets/icons/more.svg';
import WifiOffIcon from '@assets/icons/wifi_off.svg';
import PullRefresh from '@components/PullRefresh';

const Wallet: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  const { isConnected } = useNetInfo();
  const [tabIndex, setTabIndex] = useState(0);
  const currentAccount = useCurrentAccount();
  const currentNetwork = useCurrentNetwork();
  const totalPriceValue = useAssetsTotalPriceValue();

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}>
      <PullRefresh
        onRefresh={(f) => {
          setTimeout(f, 1000);
        }}
      >
        <View className="absolute left-0 right-0 flex justify-center items-center z-50" style={{ top: statusBarHeight + 48 }}>
          {!isConnected && (
            <View style={{ backgroundColor: theme.colors.textSecondary }} className="rounded-lg p-3 flex flex-row items-center">
              <WifiOffIcon color={theme.colors.textInvert} width={20} height={20} />
              <Text className="ml-1" style={{ color: theme.colors.textInvert }}>
                No Internet Connection
              </Text>
            </View>
          )}
        </View>
        <View className="px-[24px]">
          <Text className="mt-[16px] leading-tight text-[16px] text-center" style={{ color: theme.colors.textSecondary }}>
            {currentAccount?.nickname}
          </Text>

          <View className="flex items-center justify-center h-[60px] mb-[16px]">
            {totalPriceValue === null ? (
              <Skeleton width={156} height={30} />
            ) : (
              <Text
                className=" leading-tight text-[48px] text-center font-bold"
                style={{ color: Number(totalPriceValue) === 0 ? theme.colors.textSecondary : theme.colors.textPrimary }}
              >
                ${totalPriceValue}
              </Text>
            )}
          </View>

          <View className="flex flex-row">
            <Pressable className="flex items-center flex-1" onPress={() => navigation.navigate(ReceiveAddressStackName, {})}>
              <View className="flex justify-center items-center w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
                <SendIcon color="#fff" width={32} height={32} />
              </View>
              <Text className="mt-[8px] text-base" style={{ color: theme.colors.textPrimary }}>
                Send
              </Text>
            </Pressable>

            <Pressable className="flex items-center flex-1" onPress={() => navigation.navigate(ReceiveStackName)}>
              <View className="flex justify-center items-center w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
                <ReceiveIcon color="#fff" width={32} height={32} />
              </View>
              <Text className="mt-[8px] text-base" style={{ color: theme.colors.textPrimary }}>
                Receive
              </Text>
            </Pressable>

            <View className="flex items-center flex-1">
              <View className="flex justify-center items-center w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
                <BuyIcon color="#fff" width={32} height={32} />
              </View>
              <Text className="mt-[8px] text-base" style={{ color: theme.colors.textPrimary }}>
                Buy
              </Text>
            </View>

            <View className="flex items-center flex-1">
              <View className="flex justify-center items-center w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
                <MoreIcon color="#fff" width={32} height={32} />
              </View>
              <Text className="mt-[8px] text-base" style={{ color: theme.colors.textPrimary }}>
                More
              </Text>
            </View>
          </View>
        </View>

        <View className="px-[24px]">
          <Tab value={tabIndex} onChange={setTabIndex} indicatorStyle={{ backgroundColor: theme.colors.surfaceBrand }}>
            <Tab.Item title="Tokens" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
            {currentNetwork && (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID) && (
              <Tab.Item title="NFTs" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
            )}
            <Tab.Item title="Activity" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
          </Tab>
        </View>
      </PullRefresh>
      <TabView value={tabIndex} onChange={setTabIndex} animationType="spring">
        <TabView.Item style={{ width: '100%' }}>
          <TokenList />
        </TabView.Item>
        <TabView.Item style={{ width: '100%' }}>
          <ESpaceNFTList />
        </TabView.Item>
        <TabView.Item style={{ width: '100%' }}>
          <ActivityList />
        </TabView.Item>
      </TabView>
    </SafeAreaView>
  );
};

export default Wallet;
