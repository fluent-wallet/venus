import SpeedUp from '@modules/GasFee/SpeedUp';
import PasswordVerify from '@modules/PasswordVerify';
import { BSIMAvailability } from '@pages/BSIMAvailability';
import ExternalInputHandler, { useListenDeepLink } from '@pages/ExternalInputHandler';
import Home from '@pages/Home';
import BiometricsWay from '@pages/InitWallet/BiometricsWay';
import { ChangeBPin } from '@pages/InitWallet/ChangeBPIN';
import PasswordWay from '@pages/InitWallet/PasswordWay';
import { RecoverBSIM } from '@pages/InitWallet/RecoverBSIM';
import AccountManagement from '@pages/Management/AccountManagement';
import AccountSetting from '@pages/Management/AccountManagement/AccountSetting';
import AddAnotherWallet from '@pages/Management/AccountManagement/AddAnotherWallet';
import Backup from '@pages/Management/AccountManagement/Backup';
import EraseAllWallet from '@pages/Management/AccountManagement/EraseAllWallet';
import GroupSetting from '@pages/Management/AccountManagement/GroupSetting';
import HDSetting from '@pages/Management/AccountManagement/HDSetting';
import NetworkManagement from '@pages/Management/NetworkManagement';
import NetworkAddNewEndpoint from '@pages/Management/NetworkManagement/AddNewEndpoint';
import Receive from '@pages/Receive';
import SendTransaction from '@pages/SendTransaction';
import Settings from '@pages/Settings';
import AboutUs, { UpdateVersion } from '@pages/Settings/AboutUs';
import Appearance from '@pages/Settings/Appearance';
import Language from '@pages/Settings/Language';
import Preferences from '@pages/Settings/Preferences';
import SignatureRecords from '@pages/SignatureRecords';
import TooManyPending from '@pages/TooManyPending';
import TransactionDetail from '@pages/TransactionDetail';
import WalletConnect from '@pages/WalletConnect';
import { useListenWalletConnectEvent } from '@pages/WalletConnect/useWalletConnectHooks';
import WayToInitWallet from '@pages/WayToInitWallet';
import Welcome from '@pages/Welcome';
import { useNavigation, useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRuntimeEventBridge } from '@service/runtimeBridge';
import { useHasVault } from '@service/wallet';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBar, View } from 'react-native';
import {
  AboutUsStackName,
  AccountManagementStackName,
  AccountSettingStackName,
  AddAnotherWalletStackName,
  AppearanceStackName,
  BackupStackName,
  BiometricsWayStackName,
  BSIMAvailabilityStackName,
  ChangeBPinStackName,
  EraseAllWalletStackName,
  ExternalInputHandlerStackName,
  GroupSettingStackName,
  HDSettingStackName,
  HomeStackName,
  LanguageStackName,
  NetworkAddNewEndpointStackName,
  NetworkManagementStackName,
  PasswordVerifyStackName,
  PasswordWayStackName,
  PreferencesStackName,
  ReceiveStackName,
  RecoverBsimStackName,
  type RootStackParamList,
  SendTransactionStackName,
  SettingsStackName,
  SheetBottomOption,
  SignatureRecordsStackName,
  SpeedUpStackName,
  type StackNavigation,
  TooManyPendingStackName,
  TransactionDetailStackName,
  UpdateVersionStackName,
  WalletConnectStackName,
  WayToInitWalletStackName,
  WelcomeStackName,
} from './configs';
import Header from './Header';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const screenOptions = {
  orientation: 'portrait',
  header: Header,
  headerBackVisible: false,
  statusBarTranslucent: true,
  // animation: 'fade',
} as const;

const Router: React.FC = () => {
  const { t } = useTranslation();
  const { data: hasVault = false } = useHasVault();
  const { colors, mode } = useTheme();

  const navigation = useNavigation<StackNavigation>();

  useRuntimeEventBridge(navigation);

  // to listen the wallet connect plugin custom subject event
  useListenWalletConnectEvent();

  useListenDeepLink(navigation);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <StatusBar translucent backgroundColor="transparent" barStyle={mode === 'light' ? 'dark-content' : 'light-content'} />
      <RootStack.Navigator initialRouteName={hasVault ? HomeStackName : WelcomeStackName} screenOptions={screenOptions}>
        <RootStack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false, animation: 'none' }} />
        <RootStack.Screen name={WayToInitWalletStackName} component={WayToInitWallet} options={{ headerShown: false, animation: 'none' }} />
        <RootStack.Screen name={HomeStackName} component={Home} options={{ headerShown: false }} />
        <RootStack.Screen name={ChangeBPinStackName} component={ChangeBPin} />
        <RootStack.Screen name={RecoverBsimStackName} component={RecoverBSIM} />
        <RootStack.Screen name={BiometricsWayStackName} component={BiometricsWay} options={{ animation: 'fade' }} />
        <RootStack.Screen name={PasswordWayStackName} component={PasswordWay} />
        <RootStack.Screen name={AccountManagementStackName} component={AccountManagement} />
        <RootStack.Screen name={NetworkManagementStackName} component={NetworkManagement} />
        <RootStack.Screen name={NetworkAddNewEndpointStackName} component={NetworkAddNewEndpoint} options={SheetBottomOption} />
        <RootStack.Screen name={AccountSettingStackName} component={AccountSetting} options={SheetBottomOption} />
        <RootStack.Screen name={GroupSettingStackName} component={GroupSetting} options={SheetBottomOption} />
        <RootStack.Screen name={HDSettingStackName} component={HDSetting} options={SheetBottomOption} />
        <RootStack.Screen name={BackupStackName} component={Backup} options={SheetBottomOption} />
        <RootStack.Screen name={EraseAllWalletStackName} component={EraseAllWallet} options={SheetBottomOption} />
        <RootStack.Screen name={AddAnotherWalletStackName} component={AddAnotherWallet} options={SheetBottomOption} />
        <RootStack.Screen name={SendTransactionStackName} component={SendTransaction} options={SheetBottomOption} />
        <RootStack.Screen name={ExternalInputHandlerStackName} component={ExternalInputHandler} options={SheetBottomOption} />
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
        <RootStack.Screen name={SpeedUpStackName} component={SpeedUp} options={SheetBottomOption} />
        <RootStack.Screen name={TooManyPendingStackName} component={TooManyPending} options={SheetBottomOption} />
        <RootStack.Screen name={TransactionDetailStackName} component={TransactionDetail} options={{ title: t('tx.detail.title') }} />
        <RootStack.Screen name={BSIMAvailabilityStackName} component={BSIMAvailability} options={SheetBottomOption} />
      </RootStack.Navigator>
    </View>
  );
};

export default Router;
