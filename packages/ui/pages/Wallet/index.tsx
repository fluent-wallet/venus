import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, TouchableHighlight, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { firstValueFrom, delay, repeat } from 'rxjs';
import { useAtom } from 'jotai';
import { formatUnits } from 'ethers';
import { Text, useTheme, Tab, TabView, Skeleton } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { shortenAddress } from '@core/utils/address';
import { useCurrentAddressValue, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { type StackNavigation, AccountSelectStackName, ReceiveAddressStackName, ReceiveStackName } from '@router/configs';
import SwitchCurrentNetwork from '@components/SwitchCurrentNetwork';
import { nativeAndERC20tokenListAtom, requestTokenList, writeTokenListAtom } from '@hooks/useTokenList';
import TokenList from '@components/TokenList';
import NFTList from '@components/NFTList';
import CopyAll from '@assets/icons/copy_all.svg';
import Flip from '@assets/icons/flip.svg';
import Menu from '@assets/icons/menu.svg';
import SendIcon from '@assets/icons/send.svg';
import ReceiveIcon from '@assets/icons/receive.svg';
import BuyIcon from '@assets/icons/buy.svg';
import MoreIcon from '@assets/icons/more.svg';
import { TokenType } from '@hooks/useTransaction';

export const getWalletHeaderOptions = (backgroundColor: string) =>
  ({
    headerLeft: () => (
      <View className="flex flex-row ml-[17px]">
        <Menu className="w-[24] h-[24]" />
        <Flip className="w-[24] h-[24]" style={{ marginLeft: 18 }} />
      </View>
    ),
    headerTitle: () => <HeaderTitle backgroundColor={backgroundColor} />,
    headerRight: () => <>{__DEV__ && <SwitchCurrentNetwork />}</>,
    headerTitleAlign: 'center',
  } as const);

const HeaderTitle: React.FC<{ backgroundColor: string }> = ({ backgroundColor }: { backgroundColor: string }) => {
  const currentAddressValue = useCurrentAddressValue();
  const navigation = useNavigation<StackNavigation>();

  if (!currentAddressValue) return null;
  return (
    <TouchableHighlight onPress={() => navigation.navigate(AccountSelectStackName)} className="rounded-full overflow-hidden">
      <View className="bg-white flex flex-row px-[12px] py-[8px] rounded-full" style={{ backgroundColor }}>
        <Text className="text-[10px]">{shortenAddress(currentAddressValue)}</Text>
        <View className="pl-[4px]">
          <CopyAll />
        </View>
      </View>
    </TouchableHighlight>
  );
};

const Wallet: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [tokenList] = useAtom(nativeAndERC20tokenListAtom);
  const [_, writeTokenList] = useAtom(writeTokenListAtom);
  const currentNetwork = useCurrentNetwork();
  const currentAddress = useCurrentAddressValue();
  useEffect(() => {
    if (currentAddress && currentNetwork?.chainId) {
      // start with a random interval of one to five seconds. then repeat every five seconds.
      const observable = requestTokenList(
        currentNetwork?.chainId,
        currentAddress,
        [TokenType.NATIVE, TokenType.ERC20, TokenType.ERC721, TokenType.ERC1155].join(',')
      ).pipe(delay(Math.floor(Math.random() * (5 - 1 + 1) + 1) * 1000), repeat({ delay: 5 * 1000 }));

      const subscribe = observable.subscribe((res) => {
        writeTokenList(res);
      });
      return subscribe.unsubscribe;
    }
  }, [currentAddress, currentNetwork?.chainId, writeTokenList]);

  const value = tokenList
    ? tokenList.reduce((acc, cur) => (cur.priceInUSDT ? acc + Number(cur.priceInUSDT) * Number(formatUnits(cur.amount, cur.decimals)) : acc), 0).toFixed(2)
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
          {value === null ? <Skeleton width={100} height={60} /> : `$${value}`}
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
