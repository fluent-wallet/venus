import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, TouchableHighlight, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { statusBarHeight } from '@utils/deviceInfo';
import { Text, useTheme, Tab, TabView } from '@rneui/themed';
import { map, switchMap, firstValueFrom } from 'rxjs';
import { compose, withDatabase, withObservables, type Database } from '@DB/react';
import { shortenAddress } from '@core/utils/address';
import { type Address } from '@core/DB/models/Address';
import { querySelectedAddress } from '@core/DB/models/Address/service';
import { AccountSelectStackName, ReceiveAddressStackName, ReceiveStackName, type StackNavigation } from '@router/configs';
import CopyAll from '@assets/icons/copy_all.svg';
import Flip from '@assets/icons/flip.svg';
import Menu from '@assets/icons/menu.svg';
import SendIcon from '@assets/icons/send.svg';
import ReceiveIcon from '@assets/icons/receive.svg';
import BuyIcon from '@assets/icons/buy.svg';
import MoreIcon from '@assets/icons/more.svg';
import WalletTokens from './TabViews/Tokens';
import SwitchCurrentNetwork from '@components/SwitchCurrentNetwork';
import { FetchTokenListType, requestTokenList, ERC20tokenListAtom } from '../../components/TokenList/service';
import { useAtom } from 'jotai';
import { formatUnits } from 'ethers';
import TokenList from '@components/TokenList';

export const WalletStackName = 'Wallet';
export const getWalletHeaderOptions = (backgroundColor: string) =>
  ({
    headerLeft: () => (
      <View className="flex flex-row ml-[17px]">
        <Menu className="w-[24] h-[24]" />
        <Flip className="w-[24] h-[24]" style={{ marginLeft: 18 }} />
      </View>
    ),
    headerTitle: () => <CurrentAccount backgroundColor={backgroundColor} />,
    headerRight: () => <>{__DEV__ && <SwitchCurrentNetwork />}</>,
    headerTitleAlign: 'center',
  } as const);

const CurrentAccount: React.FC<{ backgroundColor: string }> = compose(
  withDatabase,
  withObservables([], ({ database }: { database: Database }) => ({
    address: querySelectedAddress(database)
      .observe()
      .pipe(map((address) => address?.[0])),
  }))
)(({ address, backgroundColor }: { address: Address; backgroundColor: string }) => {
  const navigation = useNavigation<StackNavigation>();

  if (!address) return null;
  return (
    <TouchableHighlight onPress={() => navigation.navigate(AccountSelectStackName)} className="rounded-full overflow-hidden">
      <View className="bg-white flex flex-row px-[12px] py-[8px] rounded-full" style={{ backgroundColor }}>
        <Text className="text-[10px]">{shortenAddress(address?.hex)}</Text>
        <View className="pl-[4px]">
          <CopyAll />
        </View>
      </View>
    </TouchableHighlight>
  );
});

const Wallet: React.FC<{ navigation: StackNavigation; address: Address }> = ({ navigation, address }) => {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [tokenList] = useAtom(ERC20tokenListAtom);

  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}>
      <View className="px-[24px]">
        <Text className="mt-[16px] leading-tight text-[16px] text-center" style={{ color: theme.colors.textSecondary }}>
          ePay Wallet
        </Text>

        <Text className="mb-[16px] leading-tight text-[48px] text-center font-bold" style={{ color: theme.colors.textPrimary }}>
          ${tokenList.reduce((acc, cur) => (cur.priceInUSDT ? acc + Number(cur.priceInUSDT) * Number(formatUnits(cur.amount, cur.decimals)) : acc), 0)}
        </Text>

        <View className="flex flex-row">
          <Pressable className="flex items-center flex-1" onPress={() => navigation.navigate(ReceiveAddressStackName)}>
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
        <TabView.Item>
          <TokenList />
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

export default withDatabase(
  withObservables([], ({ database }: { database: Database }) => {
    const address = querySelectedAddress(database).observe();
    return {
      address: address.pipe(map((address) => address[0])),
    };
  })(Wallet)
);
