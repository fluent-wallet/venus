import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import plugins from '@core/WalletCore/Plugins';
import Welcome from '@pages/Welcome';
import WayToInitWallet from '@pages/WayToInitWallet';
import BiometricsWay from '@pages/InitWallet/BiometricsWay';
import PasswordWay from '@pages/InitWallet/PasswordWay';
import Home from '@pages/Home';
import Settings from '@pages/Settings';
import AccountManagement from '@pages/Management/AccountManagement';
import AccountSetting from '@pages/Management/AccountManagement/AccountSetting';
import GroupSetting from '@pages/Management/AccountManagement/GroupSetting';
import HDSetting from '@pages/Management/AccountManagement/HDSetting';
import Backup from '@pages/Management/AccountManagement/Backup';
import AddAnotherWallet from '@pages/Management/AccountManagement/AddAnotherWallet';
import EraseAllWallet from '@pages/Management/AccountManagement/EraseAllWallet';
import SendTransaction from '@pages/SendTransaction';
import ScanQRCode from '@pages/ScanQRCode';
import Receive from '@pages/Receive';
import PasswordVerify from '@modules/PasswordVerify';
import AccountSelector from '@modules/AccountSelector';
import NetworkSelector from '@modules/NetworkSelector';
import {
  WelcomeStackName,
  WayToInitWalletStackName,
  HomeStackName,
  BiometricsWayStackName,
  PasswordWayStackName,
  SettingsStackName,
  AccountManagementStackName,
  AccountSettingStackName,
  GroupSettingStackName,
  HDSettingStackName,
  PasswordVerifyStackName,
  BackupStackName,
  EraseAllWalletStackName,
  AddAnotherWalletStackName,
  SendTransactionStackName,
  ScanQRCodeStackName,
  ReceiveStackName,
  AccountSelectorStackName,
  NetworkSelectorStackName,
  type RootStackParamList,
  type StackNavigation,
  SheetBottomOption,
} from './configs';
import Header from './Header';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const screenOptions = {
  orientation: 'portrait',
  header: Header,
  headerBackVisible: false,
  statusBarTranslucent: true,
  statusBarBackgroundColor: 'transparent',
} as const;

const Router: React.FC = () => {
  const hasVault = useHasVault();
  const { colors } = useTheme();

  const navigation = useNavigation<StackNavigation>();
  useEffect(() => {
    const subscription = plugins.Authentication.passwordRequestSubject.subscribe({
      next: (request) => {
        if (!request) return;
        navigation.navigate(PasswordVerifyStackName);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <RootStack.Navigator
        initialRouteName={hasVault ? HomeStackName : WelcomeStackName}
        screenOptions={{
          ...screenOptions,
        }}
      >
        <RootStack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false }} />
        <RootStack.Screen name={WayToInitWalletStackName} component={WayToInitWallet} options={{ headerShown: false }} />
        <RootStack.Screen name={HomeStackName} component={Home} options={{ headerShown: false }} />
        <RootStack.Screen name={BiometricsWayStackName} component={BiometricsWay} />
        <RootStack.Screen name={PasswordWayStackName} component={PasswordWay} />
        <RootStack.Screen name={AccountManagementStackName} component={AccountManagement} />
        <RootStack.Screen name={AccountSettingStackName} component={AccountSetting} options={SheetBottomOption} />
        <RootStack.Screen name={GroupSettingStackName} component={GroupSetting} options={SheetBottomOption} />
        <RootStack.Screen name={HDSettingStackName} component={HDSetting} options={SheetBottomOption} />
        <RootStack.Screen name={BackupStackName} component={Backup} options={SheetBottomOption} />
        <RootStack.Screen name={EraseAllWalletStackName} component={EraseAllWallet} options={SheetBottomOption} />
        <RootStack.Screen name={AddAnotherWalletStackName} component={AddAnotherWallet} options={SheetBottomOption} />
        <RootStack.Screen name={SendTransactionStackName} component={SendTransaction} options={SheetBottomOption} />
        <RootStack.Screen name={ScanQRCodeStackName} component={ScanQRCode} options={SheetBottomOption} />
        <RootStack.Screen name={ReceiveStackName} component={Receive} options={SheetBottomOption} />
        <RootStack.Screen name={SettingsStackName} component={Settings} />
        <RootStack.Screen name={PasswordVerifyStackName} component={PasswordVerify} options={SheetBottomOption} />
        <RootStack.Screen name={AccountSelectorStackName} component={AccountSelector} options={SheetBottomOption} />
        <RootStack.Screen name={NetworkSelectorStackName} component={NetworkSelector} options={SheetBottomOption} />
      </RootStack.Navigator>
    </View>
  );
};

export default Router;
