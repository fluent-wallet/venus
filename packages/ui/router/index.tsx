import React from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@rneui/themed';
import { useVaults } from '@core/WalletCore/Plugins/ReactInject';
import Welcome from '@pages/Welcome';
import SetPassword from '@pages/SetPassword';
import Biometrics from '@pages/SetPassword/Biometrics';
import Wallet, { getWalletHeaderOptions } from '@pages/Wallet';
import Settings, { SettingsStackName } from '@pages/Settings';
import ImportWallet from '@pages/ImportWallet';
import AccountManage from '@pages/Account/AccountManage';
import AccountSelect from '@pages/Account/AccountSelect';
import AddAccount from '@pages/Account/AddAccount';
import Login from '@pages/Login';
import Lock from '@pages/Lock';
import {
  type StackNavigation,
  type RootStackList,
  AccountManageStackName,
  AccountSelectStackName,
  LockStackName,
  LoginStackName,
  AddAccountStackName,
  ImportWalletStackName,
  WelcomeStackName,
  SetPasswordStackName,
  BiometricsStackName,
  WalletStackName,
  HomeStackName,
  ReceiveAddressStackName,
  TransactionConfirmStackName,
  SendToStackName,
  TokensStackName,
  BackUpStackName,
  AccountSettingStackName,
  GroupSettingStackName,
  HDManageStackName,
  ReceiveStackName,
  SetAmountStackName,
} from './configs';
import SendReceiver, { SendPageHeaderOptions } from '@pages/Transaction/ReceiveAddress';
import TransactionConfirm from '@pages/Transaction/TransactionConfirm';
import SendTo from '@pages/Transaction/SendTo';
import Tokens from '@pages/Transaction/Tokens';
import BackUp from '@pages/Account/BackUp';
import AccountSetting from '@pages/Account/Setting/AccountSetting';
import GroupSetting from '@pages/Account/Setting/GroupSetting';
import HDManage from '@pages/Account/Setting/HDManage';
import Receive from '@pages/Receive';
import SetAmount from '@pages/Receive/SetAmount';

import WalletIcon from '@assets/icons/wallet.svg';
import SettingsIcon from '@assets/icons/settings.svg';
import ArrowLeft from '@assets/icons/arrow-left.svg';

const Stack = createNativeStackNavigator<RootStackList>();
const BottomTabStack = createBottomTabNavigator();

const HomeScreenNavigator = () => {
  const { theme } = useTheme();
  return (
    <BottomTabStack.Navigator
      initialRouteName={WalletStackName}
      screenOptions={{
        headerTitleAlign: 'left',
        headerTransparent: true,
        tabBarActiveBackgroundColor: theme.colors.pureBlackAndWight,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        tabBarInactiveBackgroundColor: theme.colors.pureBlackAndWight,
        tabBarStyle: {
          borderTopWidth: 0,
        },
      }}
    >
      <BottomTabStack.Screen
        name={WalletStackName}
        component={Wallet}
        options={{ tabBarIcon: ({ color }) => <WalletIcon color={color} />, ...getWalletHeaderOptions(theme.colors.homeHeaderAddressBackgroundColor) }}
      />
      <BottomTabStack.Screen
        name={SettingsStackName}
        component={Settings}
        options={{ headerShown: false, tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }}
      />
    </BottomTabStack.Navigator>
  );
};

const StackNavigator = () => {
  const navigation = useNavigation<StackNavigation>();
  const { theme } = useTheme();
  const vaults = useVaults();

  const hasVault = vaults?.length && vaults.length > 0;
  return (
    <Stack.Navigator
      initialRouteName={hasVault ? HomeStackName : WelcomeStackName}
      screenOptions={{
        headerTitleAlign: 'left',
        headerTransparent: true,
        headerBackVisible: false,
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity className="flex flex-row items-center gap-[4px]" onPress={() => navigation.goBack()}>
              <ArrowLeft color={theme.colors.surfaceBrand} />
              {/* <Text className="text-[16px] font-medium" style={{ color: theme.colors.textBrand }}>
                Wallet
              </Text> */}
            </TouchableOpacity>
          ) : null,
        title: '',
        headerTitleStyle: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
        statusBarTranslucent: true,
        statusBarColor: 'transparent',
        ...(Platform.OS === 'android' ? { statusBarStyle: theme.mode } : null),
      }}
    >
      <Stack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false }} />
      <Stack.Screen name={SetPasswordStackName} component={SetPassword} />
      <Stack.Screen name={BiometricsStackName} component={Biometrics} />
      <Stack.Screen name={HomeStackName} component={HomeScreenNavigator} options={{ headerShown: false }} />
      <Stack.Screen name={AccountManageStackName} component={AccountManage} options={{ title: 'Manage Wallets', headerTitleAlign: 'center' }} />
      <Stack.Screen name={AccountSelectStackName} component={AccountSelect} options={{ title: 'Account', headerTitleAlign: 'center' }} />
      <Stack.Screen name={AddAccountStackName} component={AddAccount} options={{ title: 'Add Account', headerTitleAlign: 'center' }} />
      <Stack.Screen name={AccountSettingStackName} component={AccountSetting} options={{ title: 'Account', headerTitleAlign: 'center' }} />
      <Stack.Screen name={GroupSettingStackName} component={GroupSetting} options={{ title: 'Group', headerTitleAlign: 'center' }} />
      <Stack.Screen name={HDManageStackName} component={HDManage} options={{ title: 'Select HD Wallets', headerTitleAlign: 'center' }} />
      <Stack.Screen name={ImportWalletStackName} component={ImportWallet} />
      <Stack.Screen name={LoginStackName} component={Login} options={{ headerShown: false }} />
      <Stack.Screen name={LockStackName} component={Lock} options={{ headerShown: false }} />
      <Stack.Screen name={ReceiveAddressStackName} component={SendReceiver} options={{ title: 'receiving address', headerTitleAlign: 'center' }} />
      <Stack.Screen name={SendToStackName} component={SendTo} options={{ ...SendPageHeaderOptions({ title: 'Send To' }) }} />
      <Stack.Screen
        name={TransactionConfirmStackName}
        component={TransactionConfirm}
        options={{
          ...SendPageHeaderOptions({
            title: 'Transaction Confirm',
          }),
        }}
      />
      <Stack.Screen
        name={TokensStackName}
        component={Tokens}
        options={{
          ...SendPageHeaderOptions({
            title: 'Tokens',
          }),
        }}
      />
      <Stack.Screen name={BackUpStackName} component={BackUp} options={{ headerTitleAlign: 'center' }} />
      <Stack.Screen name={ReceiveStackName} component={Receive} />
      <Stack.Screen name={SetAmountStackName} component={SetAmount} />
    </Stack.Navigator>
  );
};

const Router: React.FC = () => (
  <NavigationContainer>
    <StackNavigator />
  </NavigationContainer>
);

export default Router;
