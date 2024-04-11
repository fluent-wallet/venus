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
import Settings from '@pages/Settings';
import AboutUs from '@pages/Settings/AboutUs';
import Preferences from '@pages/Settings/Preferences';
import Appearance from '@pages/Settings/Appearance';
import Language from '@pages/Settings/Language';
import {
  WelcomeStackName,
  WayToInitWalletStackName,
  HomeStackName,
  BiometricsWayStackName,
  PasswordWayStackName,
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
  SettingsStackName,
  AboutUsStackName,
  PreferencesStackName,
  AppearanceStackName,
  LanguageStackName,
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
  // animation: 'fade',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <RootStack.Navigator initialRouteName={hasVault ? HomeStackName : WelcomeStackName} screenOptions={screenOptions}>
        <RootStack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false, animation: 'none' }} />
        <RootStack.Screen name={WayToInitWalletStackName} component={WayToInitWallet} options={{ headerShown: false, animation: 'none' }} />
        <RootStack.Screen name={HomeStackName} component={Home} options={{ headerShown: false }} />
        <RootStack.Screen name={BiometricsWayStackName} component={BiometricsWay} options={{ animation: 'fade' }} />
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
        <RootStack.Screen name={PasswordVerifyStackName} component={PasswordVerify} options={SheetBottomOption} />
        <RootStack.Screen name={SettingsStackName} component={Settings} />
        <RootStack.Screen name={AboutUsStackName} component={AboutUs} />
        <RootStack.Screen name={PreferencesStackName} component={Preferences} />
        <RootStack.Screen name={AppearanceStackName} component={Appearance} options={SheetBottomOption} />
        <RootStack.Screen name={LanguageStackName} component={Language} options={SheetBottomOption} />
      </RootStack.Navigator>
    </View>
  );
};

export default Router;
