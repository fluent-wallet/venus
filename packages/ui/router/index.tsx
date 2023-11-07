import React, { type PropsWithChildren } from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@rneui/themed';
import Welcome, { WelcomeStackName } from '@pages/Welcome';
import SetPassword, { SetPasswordStackName } from '@pages/SetPassword';
import Biometrics, { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import Wallet, { WalletStackName, getWalletHeaderOptions } from '@pages/Wallet';
import Settings, { SettingsStackName } from '@pages/Settings';
import ImportWallet, { ImportWalletStackName } from '@pages/ImportWallet';
import AccountManage, { AccountManageStackName } from '@pages/Account/AccountManage';
import AccountSelect, { AccountSelectStackName } from '@pages/Account/AccountSelect';
import AddAccount, { AddAccountStackName } from '@pages/Account/AddAccount';
import Login, { LoginStackName } from '@pages/Login';
import Lock, { LockStackName } from '@pages/Lock';
import { withDatabase, withObservables, compose, type Database } from '@DB/react';
import TableName from '@DB/TableName';
import { HomeStackName, type StackNavigation, type RootStackList } from './configs';
import SendReceiver, { SendPageHeaderOptions, ReceiveAddressStackName } from '@pages/Transaction/ReceiveAddress';
import TransactionConfirm, { TransactionConfirmStackName } from '@pages/Transaction/TransactionConfirm';
import SendTo, { SendToStackName } from '@pages/Transaction/SendTo';
import TokenList, { TokenListStackName } from '@pages/Transaction/TokenList';
import BackUp, { BackUpStackName } from '@pages/Account/BackUp';
import AccountSetting, { AccountSettingStackName } from '@pages/Account/Setting/AccountSetting';
import GroupSetting, { GroupSettingStackName } from '@pages/Account/Setting/GroupSetting';
import HDManage, { HDManageStackName } from '@pages/Account/Setting/HDManage';
import Receive, { ReceiveStackName } from '@pages/Receive';
import SetAmount, { SetAmountStackName } from '@pages/Receive/SetAmount';
import { useInitSelectedAccount } from '@pages/Account/AccountGroupItem';

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

const StackNavigator = compose(
  withDatabase,
  withObservables([], ({ database }: { database: Database }) => ({ vaultCount: database.collections.get(TableName.Vault).query().observeCount() }))
)(({ vaultCount }: PropsWithChildren & { vaultCount: number }) => {
  const navigation = useNavigation<StackNavigation>();
  const { theme } = useTheme();

  const hasVault = vaultCount > 0;
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
      <Stack.Screen
        name={SendToStackName}
        component={SendTo}
        options={{ ...SendPageHeaderOptions({ titleColor: theme.colors.contrastWhiteAndBlack, borderColor: theme.colors.surfaceSecondary }) }}
      />
      <Stack.Screen
        name={TransactionConfirmStackName}
        component={TransactionConfirm}
        options={{
          ...SendPageHeaderOptions({
            titleColor: theme.colors.contrastWhiteAndBlack,
            borderColor: theme.colors.surfaceSecondary,
            title: 'Transaction Confirm',
          }),
        }}
      />
      <Stack.Screen
        name={TokenListStackName}
        component={TokenList}
        options={{
          ...SendPageHeaderOptions({
            titleColor: theme.colors.contrastWhiteAndBlack,
            borderColor: theme.colors.surfaceSecondary,
            title: 'Tokens',
          }),
        }}
      />
      <Stack.Screen name={BackUpStackName} component={BackUp} options={{ headerTitleAlign: 'center' }} />
      <Stack.Screen name={ReceiveStackName} component={Receive} />
      <Stack.Screen name={SetAmountStackName} component={SetAmount} />
    </Stack.Navigator>
  );
});

const Router: React.FC = () => {
  useInitSelectedAccount();
  return (
    <NavigationContainer>
      <StackNavigator />
    </NavigationContainer>
  );
};

export default Router;
