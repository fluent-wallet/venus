import React, { useState } from 'react';
import { View, SafeAreaView, Pressable } from 'react-native';
import { useAtom } from 'jotai';
import { formatUnits } from 'ethers';
import { Text, useTheme, Tab, TabView } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { type StackNavigation, ReceiveAddressStackName, ReceiveStackName } from '@router/configs';
import { nativeTokenAtom, readScanAndFallbackTokenListAtom } from '@hooks/useTokenList';
import TokenList from '@components/TokenList';
import NFTList from '@components/NFTList';
import SendIcon from '@assets/icons/send.svg';
import ReceiveIcon from '@assets/icons/receive.svg';
import BuyIcon from '@assets/icons/buy.svg';
import MoreIcon from '@assets/icons/more.svg';
const Wallet: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [ERC20TokenList] = useAtom(readScanAndFallbackTokenListAtom);
  const [nativeToken] = useAtom(nativeTokenAtom);
  const tokenList = nativeToken && ERC20TokenList ? [nativeToken, ...ERC20TokenList] : ERC20TokenList;

  const value = tokenList
    ? tokenList.reduce((acc, cur) => (cur.priceInUSDT ? acc + Number(cur.priceInUSDT) * Number(formatUnits(cur.balance, cur.decimals)) : acc), 0).toFixed(2)
    : null;

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}>
      <View className="px-[24px]">
        <Text className="mt-[16px] leading-tight text-[16px] text-center" style={{ color: theme.colors.textSecondary }}>
          ePay Wallet
        </Text>

        <Text
          className="mb-[16px] leading-tight text-[48px] text-center font-bold"
          style={{ color: Number(value) === 0 ? theme.colors.textSecondary : theme.colors.textPrimary }}
        >
          {value === null ? '--' : `$${value}`}
        </Text>

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
          <Tab.Item title="NFTs" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
          <Tab.Item title="Activity" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
        </Tab>
      </View>

      <TabView value={tabIndex} onChange={setTabIndex} animationType="spring">
        <TabView.Item className="w-full">
          <TokenList />
        </TabView.Item>
        <TabView.Item className="w-full">
          <NFTList />
        </TabView.Item>
        <TabView.Item className="w-full">
          <Text h1>Activity</Text>
        </TabView.Item>
      </TabView>
    </SafeAreaView>
  );
};

export default Wallet;
