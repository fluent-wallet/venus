import plugins from '@core/WalletCore/Plugins';
import { useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import PasswordVerify from '@modules/PasswordVerify';
import Home from '@pages/Home';
import BiometricsWay from '@pages/InitWallet/BiometricsWay';
import PasswordWay from '@pages/InitWallet/PasswordWay';
import AccountManagement from '@pages/Management/AccountManagement';
import AccountSetting from '@pages/Management/AccountManagement/AccountSetting';
import AddAnotherWallet from '@pages/Management/AccountManagement/AddAnotherWallet';
import Backup from '@pages/Management/AccountManagement/Backup';
import EraseAllWallet from '@pages/Management/AccountManagement/EraseAllWallet';
import GroupSetting from '@pages/Management/AccountManagement/GroupSetting';
import HDSetting from '@pages/Management/AccountManagement/HDSetting';
import Receive from '@pages/Receive';
import ScanQRCode from '@pages/ScanQRCode';
import SendTransaction from '@pages/SendTransaction';
import Settings from '@pages/Settings';
import AboutUs, { UpdateVersion } from '@pages/Settings/AboutUs';
import Appearance from '@pages/Settings/Appearance';
import Language from '@pages/Settings/Language';
import Preferences from '@pages/Settings/Preferences';
import SignatureRecords from '@pages/SignatureRecords';
import WalletConnect from '@pages/WalletConnect';
import { useListenWalletConnectEvent } from '@pages/WalletConnect/useWalletConnectHooks';
import WayToInitWallet from '@pages/WayToInitWallet';
import Welcome from '@pages/Welcome';
import { useNavigation, useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type React from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';
import Header from './Header';
import {
  AboutUsStackName,
  UpdateVersionStackName,
  AccountManagementStackName,
  AccountSettingStackName,
  AddAnotherWalletStackName,
  AppearanceStackName,
  BackupStackName,
  BiometricsWayStackName,
  EraseAllWalletStackName,
  GroupSettingStackName,
  HDSettingStackName,
  HomeStackName,
  LanguageStackName,
  PasswordVerifyStackName,
  PasswordWayStackName,
  PreferencesStackName,
  ReceiveStackName,
  type RootStackParamList,
  ScanQRCodeStackName,
  SendTransactionStackName,
  SettingsStackName,
  SheetBottomOption,
  SignatureRecordsStackName,
  type StackNavigation,
  WalletConnectStackName,
  WayToInitWalletStackName,
  WelcomeStackName,
  NetworkManagementStackName,
  AddNewRPCStackName,
} from './configs';
import NetworkManagement from '@pages/Settings/Network';
import AddNewRPC from '@pages/Settings/AddNewRPC';

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
  // to listen the wallet connect plugin custom subject event
  useListenWalletConnectEvent();

  useEffect(() => {
    const sub = plugins.Authentication.subPasswordRequest().subscribe(() => {
      navigation.navigate(PasswordVerifyStackName);
    });
    return () => {
      sub.unsubscribe();
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
        <RootStack.Screen name={NetworkManagementStackName} component={NetworkManagement} />
        <RootStack.Screen name={AddNewRPCStackName} component={AddNewRPC} options={SheetBottomOption} />
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
        <RootStack.Screen name={UpdateVersionStackName} component={UpdateVersion} options={SheetBottomOption} />
        <RootStack.Screen name={PreferencesStackName} component={Preferences} />
        <RootStack.Screen name={AppearanceStackName} component={Appearance} options={SheetBottomOption} />
        <RootStack.Screen name={LanguageStackName} component={Language} options={SheetBottomOption} />

        <RootStack.Screen name={WalletConnectStackName} component={WalletConnect} options={SheetBottomOption} />
        <RootStack.Screen name={SignatureRecordsStackName} component={SignatureRecords} />
      </RootStack.Navigator>
    </View>
  );
};

export default Router;
