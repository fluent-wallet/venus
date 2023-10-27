import React, { useState, useMemo } from 'react';
import { View, SafeAreaView, TouchableHighlight } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { statusBarHeight } from '@utils/deviceInfo';
import { shortenAddress } from '@cfx-kit/dapp-utils/dist/address';
import { Text, useTheme, Tab, TabView } from '@rneui/themed';
import { map } from 'rxjs';
import { compose, withDatabase, withObservables, type Database } from '@DB/react';
import { type Address } from '@core/DB/models/Address';
import { querySelectedAddress } from '@core/DB/models/Address/service';
import { AccountSelectStackName, type StackNavigation } from '@router/configs';
import CopyAll from '@assets/icons/copy_all.svg';
import Flip from '@assets/icons/flip.svg';
import Menu from '@assets/icons/menu.svg';
import SendIcon from '@assets/icons/send.svg';
import ReceiveIcon from '@assets/icons/receive.svg';
import BuyIcon from '@assets/icons/buy.svg';
import MoreIcon from '@assets/icons/more.svg';
import WalletTokens from './TabViews/Tokens';

export const WalletStackName = 'Wallet';

export const getWalletHeaderOptions = (backgroundColor: string) =>
  ({
    headerLeft: () => (
      <View className="ml-[17px]">
        <Menu className="w-[24] h-[24]" />
      </View>
    ),
    headerTitle: () => <CurrentAccount backgroundColor={backgroundColor} />,
    headerRight: () => (
      <View className="flex flex-row mr-[17px]">
        <Flip style={{ marginRight: 17 }} />
      </View>
    ),
    headerTitleAlign: 'center',
  } as const);

const CurrentAccount: React.FC<{ backgroundColor: string }> = compose(
  withDatabase,
  withObservables([], ({ database }: { database: Database }) => ({
    address: querySelectedAddress(database)
      .observe()
      .pipe(map((account) => account?.[0])),
  }))
)(({ address, backgroundColor }: { address: Address; backgroundColor: string }) => {
  const navigation = useNavigation<StackNavigation>();
  const shortAddress = useMemo(() => shortenAddress(address?.hex), [address]);

  if (!address) return null;
  return (
    <TouchableHighlight onPress={() => navigation.navigate(AccountSelectStackName)} className="rounded-full overflow-hidden">
      <View className="bg-white flex flex-row px-[12px] py-[8px] rounded-full" style={{ backgroundColor }}>
        <Text className="text-[10px]">{shortAddress}</Text>
        <View className="pl-[4px]">
          <CopyAll />
        </View>
      </View>
    </TouchableHighlight>
  );
});

const Wallet: React.FC<{ navigation: StackNavigation }> = () => {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);

  return (
    <SafeAreaView
      className="flex-1 flex flex-col justify-start px-[24px]"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <Text className="mt-[16px] leading-tight text-[16px] text-center" style={{ color: theme.colors.textSecondary }}>
        ePay Wallet
      </Text>

      <Text className="mb-[16px] leading-tight text-[48px] text-center font-bold" style={{ color: theme.colors.textPrimary }}>
        $9.41
      </Text>

      <View className="flex flex-row">
        <View className="flex items-center flex-1">
          <View className="flex justify-center items-center w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
            <SendIcon color="#fff" width={32} height={32} />
          </View>
          <Text className="mt-[8px] text-base" style={{ color: theme.colors.textPrimary }}>
            Send
          </Text>
        </View>

        <View className="flex items-center flex-1">
          <View className="flex justify-center items-center w-[60px] h-[60px] rounded-full" style={{ backgroundColor: theme.colors.surfaceBrand }}>
            <ReceiveIcon color="#fff" width={32} height={32} />
          </View>
          <Text className="mt-[8px] text-base" style={{ color: theme.colors.textPrimary }}>
            Receive
          </Text>
        </View>

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

      <Tab value={tabIndex} onChange={setTabIndex} indicatorStyle={{ backgroundColor: theme.colors.surfaceBrand }}>
        <Tab.Item title="Tokens" titleStyle={(active) => ({ color: active ? '#4572EC' : theme.colors.textSecondary })} />
        <Tab.Item title="Receive" titleStyle={(active) => ({ color: active ? '#4572EC' : theme.colors.textSecondary })} />
        <Tab.Item title="Activity" titleStyle={(active) => ({ color: active ? '#4572EC' : theme.colors.textSecondary })} />
      </Tab>

      <TabView value={tabIndex} onChange={setTabIndex} animationType="spring" tabItemContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}>
        <TabView.Item>
          <WalletTokens />
        </TabView.Item>
        <TabView.Item>
          <Text h1>Receive1</Text>
        </TabView.Item>
        <TabView.Item>
          <Text h1>Activity</Text>
        </TabView.Item>
      </TabView>
    </SafeAreaView>
  );
};

export default Wallet;
