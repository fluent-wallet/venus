import { resolveSheetHeight } from '@components/Sheet/sizing';
import SpeedUp from '@modules/GasFee/SpeedUp';
import PasswordVerify from '@modules/PasswordVerify';
import AccountSelector from '@pages/AccountSelector';
import { BSIMAvailability } from '@pages/BSIMAvailability';
import ExternalInputHandler from '@pages/ExternalInputHandler';
import Home from '@pages/Home';
import BiometricsWay from '@pages/InitWallet/BiometricsWay';
import { ChangeBPin } from '@pages/InitWallet/ChangeBPIN';
import PasswordWay from '@pages/InitWallet/PasswordWay';
import { RecoverBSIM } from '@pages/InitWallet/RecoverBSIM';
import AccountManagement from '@pages/Management/AccountManagement';
import AccountSetting from '@pages/Management/AccountManagement/AccountSetting';
import AddAnotherWallet from '@pages/Management/AccountManagement/AddAnotherWallet';
import BackupSuccess from '@pages/Management/AccountManagement/Backup/BackupSuccess';
import { BSIMStep1Password } from '@pages/Management/AccountManagement/Backup/BSIMStep1Password';
import { BSIMStep2QRCode } from '@pages/Management/AccountManagement/Backup/BSIMStep2QRCode';
import BackupStep1Notice from '@pages/Management/AccountManagement/Backup/Step1Notice';
import BackupStep2ViewSecret from '@pages/Management/AccountManagement/Backup/Step2ViewSecret';
import BackupStep3RandomCheck from '@pages/Management/AccountManagement/Backup/Step3RandomCheck';
import EraseAllWallet from '@pages/Management/AccountManagement/EraseAllWallet';
import GroupSetting from '@pages/Management/AccountManagement/GroupSetting';
import HDSetting from '@pages/Management/AccountManagement/HDSetting';
import NetworkManagement from '@pages/Management/NetworkManagement';
import NetworkAddNewEndpoint from '@pages/Management/NetworkManagement/AddNewEndpoint';
import Receive from '@pages/Receive';
import SendTransactionStep1Receiver from '@pages/SendTransaction/Step1Receiver';
import SendTransactionStep2Asset from '@pages/SendTransaction/Step2Asset';
import SendTransactionStep3Amount from '@pages/SendTransaction/Step3Amount';
import SendTransactionStep4Confirm from '@pages/SendTransaction/Step4Confirm';
import Settings from '@pages/Settings';
import AboutUs, { UpdateVersion } from '@pages/Settings/AboutUs';
import Appearance from '@pages/Settings/Appearance';
import Language from '@pages/Settings/Language';
import Preferences from '@pages/Settings/Preferences';
import SignatureRecords from '@pages/SignatureRecords';
import TooManyPending from '@pages/TooManyPending';
import TransactionDetail from '@pages/TransactionDetail';
import WalletConnectProposal from '@pages/WalletConnect/Proposal';
import WalletConnectSessions from '@pages/WalletConnect/Sessions';
import WalletConnectSignMessage from '@pages/WalletConnect/SignMessage';
import WalletConnectTransaction from '@pages/WalletConnect/Transaction';
import WayToInitWallet from '@pages/WayToInitWallet';
import Welcome from '@pages/Welcome';
import { useNavigation, useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRuntimeEventBridge } from '@service/runtimeBridge';
import { useHasVault } from '@service/wallet';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBar, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AboutUsStackName,
  AccountManagementStackName,
  AccountSelectorStackName,
  AccountSettingStackName,
  AddAnotherWalletStackName,
  AppearanceStackName,
  BackupBSIM1PasswordStackName,
  BackupBSIMQ2RCodeStackName,
  BackupStep1StackName,
  BackupStep2StackName,
  BackupStep3StackName,
  BackupSuccessStackName,
  BiometricsWayStackName,
  BSIMAvailabilityStackName,
  ChangeBPinStackName,
  EraseAllWalletStackName,
  ExternalInputHandlerStackName,
  GroupSettingStackName,
  getFormSheetOptions,
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
  SendTransactionStep1StackName,
  SendTransactionStep2StackName,
  SendTransactionStep3StackName,
  SendTransactionStep4StackName,
  SettingsStackName,
  SheetBottomOption,
  SignatureRecordsStackName,
  SpeedUpStackName,
  type StackNavigation,
  TooManyPendingStackName,
  TransactionDetailStackName,
  UpdateVersionStackName,
  WalletConnectProposalStackName,
  WalletConnectSessionsStackName,
  WalletConnectSignMessageStackName,
  WalletConnectTransactionStackName,
  WayToInitWalletStackName,
  WelcomeStackName,
} from './configs';
import Header from './Header';
import { useListenDeepLink } from './useListenDeepLink';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const screenOptions = {
  orientation: 'portrait',
  header: Header,
  headerBackVisible: false,
  statusBarTranslucent: true,
  // animation: 'fade',
} as const;

const Router: React.FC<{ onLayout?: () => void }> = ({ onLayout }) => {
  const { t } = useTranslation();
  const { data: hasVault = false } = useHasVault();
  const { colors, mode } = useTheme();
  const formSheetOptions = getFormSheetOptions(colors.bgFourth);
  const sendFormSheetOptions = getFormSheetOptions(colors.bgFourth, [0.8]);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheetDimensions = {
    windowHeight,
    availableHeight: Math.max(0, windowHeight - insets.top - insets.bottom),
  };
  const largeSheetHeight = resolveSheetHeight('large', sheetDimensions);
  // A fixed content height lets fitToContents preserve the app's large-sheet rule.
  const largeFormSheetOptions = {
    ...formSheetOptions,
    contentStyle: [formSheetOptions.contentStyle, { height: largeSheetHeight }],
  };
  const accountSelectorFormSheetOptions = {
    ...formSheetOptions,
    contentStyle: [formSheetOptions.contentStyle, { height: resolveSheetHeight({ fraction: 0.8 }, sheetDimensions) }],
  };
  const passwordFormSheetOptions = {
    ...formSheetOptions,
    contentStyle: [formSheetOptions.contentStyle, { height: resolveSheetHeight({ height: 348 }, sheetDimensions) }],
  };
  const tooManyPendingFormSheetOptions = {
    ...formSheetOptions,
    contentStyle: [formSheetOptions.contentStyle, { height: resolveSheetHeight({ height: 480 }, sheetDimensions) }],
  };
  const speedUpFormSheetOptions = {
    ...formSheetOptions,
    contentStyle: [formSheetOptions.contentStyle, { height: resolveSheetHeight({ height: 650 }, sheetDimensions) }],
  };
  const backupSuccessFormSheetOptions = {
    ...formSheetOptions,
    contentStyle: [formSheetOptions.contentStyle, { height: resolveSheetHeight({ height: 300 }, sheetDimensions) }],
  };
  const addAnotherWalletFormSheetOptions = {
    ...formSheetOptions,
    contentStyle: [formSheetOptions.contentStyle, { height: resolveSheetHeight({ height: 306 }, sheetDimensions) }],
  };
  const eraseAllWalletFormSheetOptions = {
    ...formSheetOptions,
    contentStyle: [formSheetOptions.contentStyle, { height: resolveSheetHeight({ height: 400 }, sheetDimensions) }],
  };

  const navigation = useNavigation<StackNavigation>();

  useRuntimeEventBridge(navigation);

  useListenDeepLink(navigation);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }} onLayout={onLayout}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} />
      <RootStack.Navigator initialRouteName={hasVault ? HomeStackName : WelcomeStackName} screenOptions={screenOptions}>
        <RootStack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false, animation: 'none' }} />
        <RootStack.Screen name={WayToInitWalletStackName} component={WayToInitWallet} options={{ headerShown: false, animation: 'none' }} />
        <RootStack.Screen name={HomeStackName} component={Home} options={{ headerShown: false }} />
        <RootStack.Screen name={ChangeBPinStackName} component={ChangeBPin} />
        <RootStack.Screen name={RecoverBsimStackName} component={RecoverBSIM} />
        <RootStack.Screen name={BiometricsWayStackName} component={BiometricsWay} options={{ animation: 'fade' }} />
        <RootStack.Screen name={PasswordWayStackName} component={PasswordWay} />
        <RootStack.Screen name={AccountSelectorStackName} component={AccountSelector} options={accountSelectorFormSheetOptions} />
        <RootStack.Screen
          name={AccountManagementStackName}
          component={AccountManagement}
          options={({ route }) => {
            // Keep the selector attached underneath the opaque management page.
            return route.params?.fromAccountSelector
              ? { presentation: 'transparentModal', contentStyle: { backgroundColor: colors.bgPrimary } }
              : { presentation: 'card' };
          }}
        />
        <RootStack.Screen name={NetworkManagementStackName} component={NetworkManagement} />
        <RootStack.Screen name={NetworkAddNewEndpointStackName} component={NetworkAddNewEndpoint} options={getFormSheetOptions(colors.bgFourth, [0.4])} />
        <RootStack.Screen name={AccountSettingStackName} component={AccountSetting} options={largeFormSheetOptions} />
        <RootStack.Screen name={GroupSettingStackName} component={GroupSetting} options={largeFormSheetOptions} />
        <RootStack.Screen name={HDSettingStackName} component={HDSetting} options={largeFormSheetOptions} />
        <RootStack.Screen name={BackupStep1StackName} component={BackupStep1Notice} options={largeFormSheetOptions} />
        <RootStack.Screen name={BackupStep2StackName} component={BackupStep2ViewSecret} options={largeFormSheetOptions} />
        <RootStack.Screen name={BackupStep3StackName} component={BackupStep3RandomCheck} options={largeFormSheetOptions} />
        <RootStack.Screen name={BackupSuccessStackName} component={BackupSuccess} options={backupSuccessFormSheetOptions} />
        <RootStack.Screen name={BackupBSIM1PasswordStackName} component={BSIMStep1Password} options={largeFormSheetOptions} />
        <RootStack.Screen name={BackupBSIMQ2RCodeStackName} component={BSIMStep2QRCode} options={largeFormSheetOptions} />
        <RootStack.Screen name={EraseAllWalletStackName} component={EraseAllWallet} options={eraseAllWalletFormSheetOptions} />
        <RootStack.Screen name={AddAnotherWalletStackName} component={AddAnotherWallet} options={addAnotherWalletFormSheetOptions} />
        <RootStack.Screen name={SendTransactionStep1StackName} component={SendTransactionStep1Receiver} options={sendFormSheetOptions} />
        <RootStack.Screen name={SendTransactionStep2StackName} component={SendTransactionStep2Asset} options={sendFormSheetOptions} />
        <RootStack.Screen name={SendTransactionStep3StackName} component={SendTransactionStep3Amount} options={getFormSheetOptions(colors.bgFourth, [0.75])} />
        <RootStack.Screen name={SendTransactionStep4StackName} component={SendTransactionStep4Confirm} options={largeFormSheetOptions} />
        <RootStack.Screen
          name={ExternalInputHandlerStackName}
          component={ExternalInputHandler}
          options={({ route }) => (route.params?.data ? getFormSheetOptions(colors.bgFourth, [0.4]) : largeFormSheetOptions)}
        />
        <RootStack.Screen name={ReceiveStackName} component={Receive} options={largeFormSheetOptions} />
        <RootStack.Screen name={PasswordVerifyStackName} options={passwordFormSheetOptions}>
          {(props) => <PasswordVerify key={props.route.params?.requestId} {...props} />}
        </RootStack.Screen>
        <RootStack.Screen name={SettingsStackName} component={Settings} />
        <RootStack.Screen name={AboutUsStackName} component={AboutUs} />
        <RootStack.Screen name={UpdateVersionStackName} component={UpdateVersion} options={SheetBottomOption} />
        <RootStack.Screen name={PreferencesStackName} component={Preferences} />
        <RootStack.Screen name={AppearanceStackName} component={Appearance} options={formSheetOptions} />
        <RootStack.Screen name={LanguageStackName} component={Language} options={formSheetOptions} />
        <RootStack.Screen name={WalletConnectProposalStackName} options={largeFormSheetOptions}>
          {(props) => <WalletConnectProposal key={props.route.params.requestId} {...props} />}
        </RootStack.Screen>
        <RootStack.Screen name={WalletConnectSignMessageStackName} options={largeFormSheetOptions}>
          {(props) => <WalletConnectSignMessage key={props.route.params.requestId} {...props} />}
        </RootStack.Screen>
        <RootStack.Screen name={WalletConnectTransactionStackName} options={largeFormSheetOptions}>
          {(props) => <WalletConnectTransaction key={props.route.params.requestId} {...props} />}
        </RootStack.Screen>
        <RootStack.Screen name={WalletConnectSessionsStackName} component={WalletConnectSessions} options={getFormSheetOptions(colors.bgFourth, [0.55])} />
        <RootStack.Screen name={SignatureRecordsStackName} component={SignatureRecords} />
        <RootStack.Screen name={SpeedUpStackName} component={SpeedUp} options={speedUpFormSheetOptions} />
        <RootStack.Screen name={TooManyPendingStackName} component={TooManyPending} options={tooManyPendingFormSheetOptions} />
        <RootStack.Screen name={TransactionDetailStackName} component={TransactionDetail} options={{ title: t('tx.detail.title') }} />
        <RootStack.Screen name={BSIMAvailabilityStackName} component={BSIMAvailability} options={getFormSheetOptions(colors.bgFourth, [0.35])} />
      </RootStack.Navigator>
    </View>
  );
};

export default Router;
