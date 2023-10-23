import { View, SafeAreaView } from 'react-native';
import { statusBarHeight } from '@utils/deviceInfo';
import { Text, useTheme, Tab, TabView } from '@rneui/themed';
import { useState } from 'react';
import { StackNavigation } from 'packages/@types/natigation';
import CopyAll from '@assets/icons/copy_all.svg';
import Flip from '@assets/icons/flip.svg';
import Menu from '@assets/icons/menu.svg';
import SendIcon from '@assets/icons/send.svg';
import ReceiveIcon from '@assets/icons/receive.svg';
import BuyIcon from '@assets/icons/buy.svg';
import MoreIcon from '@assets/icons/more.svg';
import WalletTokens from './Components/Tokens';

export const WalletStackName = 'Wallet';

export const getWalletHeaderOptions = (backgroundColor: string) => ({
  headerLeft: () => (
    <View className="ml-[17px]">
      <Menu className="w-[24] h-[24]" />
    </View>
  ),
  headerTitle: () => (
    <View className="bg-white flex flex-row px-[12px] py-[8px] rounded-full" style={{ backgroundColor }}>
      <Text className="text-[10px]">0x63...c6e9</Text>
      <View className="pl-[4px]">
        <CopyAll />
      </View>
    </View>
  ),
  headerRight: () => (
    <View className="flex flex-row mr-[17px]">
      <Flip style={{ marginRight: 17 }} />
    </View>
  ),
  headerTitleAlign: 'center',
} as const);

const Wallet: React.FC<{ navigation: StackNavigation }> = () => {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);

  return (
    <View className="flex flex-1 relative" style={{ backgroundColor: theme.colors.normalBackground }}>
      <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight + 48 }}>
        <View className="flex flex-1 ">
          <View
            className="px-[25px]
          "
          >
            <View className="flex justify-center items-center mt-[15px]">
              <Text className="text-[16px] leading-tight font-normal" style={{ color: theme.colors.textSecondary }}>
                ePay Wallet
              </Text>
            </View>

            <View className="flex justify-center items-center mb-[17px]">
              <Text className="text-[48px] leading-tight font-bold" style={{ color: theme.colors.textPrimary }}>
                $9.41
              </Text>
            </View>

            <View className="flex flex-row">
              <View className="flex items-center flex-1">
                <View className="flex justify-center items-center w-[60px] h-[60px] bg-[#537FF6] rounded-full">
                  <SendIcon color={'#fff'} width={32} height={32} />
                </View>
                <Text className="mt-[7px] text-base" style={{ color: theme.colors.textPrimary }}>
                  Send
                </Text>
              </View>
              <View className="flex items-center flex-1">
                <View className="flex justify-center items-center w-[60px] h-[60px]  rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
                  <ReceiveIcon color={'#fff'} width={32} height={32} />
                </View>
                <Text className="mt-[7px] text-base" style={{ color: theme.colors.textPrimary }}>
                  Receive
                </Text>
              </View>
              <View className="flex items-center flex-1">
                <View className="flex justify-center items-center w-[60px] h-[60px]  rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
                  <BuyIcon color={'#fff'} width={32} height={32} />
                </View>
                <Text className="mt-[7px] text-base" style={{ color: theme.colors.textPrimary }}>
                  Buy
                </Text>
              </View>
              <View className="flex items-center flex-1">
                <View className="flex justify-center items-center w-[60px] h-[60px]  rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
                  <MoreIcon color={'#fff'} width={32} height={32} />
                </View>
                <Text className="mt-[7px] text-base" style={{ color: theme.colors.textPrimary }}>
                  More
                </Text>
              </View>
            </View>
          </View>

          <View className="px-[25px]">
            <Tab value={tabIndex} onChange={setTabIndex} indicatorStyle={{ backgroundColor: theme.colors.surfaceBrand }}>
              <Tab.Item title="Tokens" titleStyle={(active) => ({ color: active ? '#4572EC' : theme.colors.textSecondary })} />
              <Tab.Item title="Receive" titleStyle={(active) => ({ color: active ? '#4572EC' : theme.colors.textSecondary })} />
              <Tab.Item title="Activity" titleStyle={(active) => ({ color: active ? '#4572EC' : theme.colors.textSecondary })} />
            </Tab>
          </View>
          <TabView value={tabIndex} onChange={setTabIndex} animationType="spring">
            <TabView.Item className="px-[25px] pt-[15px]">
              <WalletTokens />
            </TabView.Item>
            <TabView.Item className="px-[25px] pt-[15px]">
              <Text h1>Receive</Text>
            </TabView.Item>
            <TabView.Item className="px-[25px] pt-[15px]">
              <Text h1>Activity</Text>
            </TabView.Item>
          </TabView>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default Wallet;
