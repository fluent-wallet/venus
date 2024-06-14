import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { type NFTItemDetail } from '@core/WalletCore/Plugins/NFTDetailTracker';
import type { IWCSendTransactionEventData, IWCSessionProposalEventData, IWCSignMessageEventData } from '@core/WalletCore/Plugins/WalletConnect/types';

export const WelcomeStackName = 'Welcome';
export const WayToInitWalletStackName = 'WayToInitWallet';
export const BiometricsWayStackName = 'Biometrics';
export const PasswordWayStackName = 'PasswordWay';
export const HomeStackName = 'Home';
export const AccountManagementStackName = 'WalletManagement';
export const AccountSettingStackName = 'AccountSetting';
export const GroupSettingStackName = 'GroupSettin';
export const HDSettingStackName = 'HDSetting';
export const BackupStackName = 'Backup';
export const NetworkManagementStackName = 'NetworkManagement';
export const PasswordVerifyStackName = 'PasswordVerify';
export const SendTransactionStackName = 'SendTransaction';
export const ScanQRCodeStackName = 'ScanQRCode';
export const ReceiveStackName = 'Receive';
export const EraseAllWalletStackName = 'EraseAllWallet';
export const AddAnotherWalletStackName = 'AddAnotherWallet';
export const SettingsStackName = 'Settings';
export const AboutUsStackName = 'AboutUs';
export const PreferencesStackName = 'Preferences';
export const AppearanceStackName = 'Appearance';
export const LanguageStackName = 'Language';
export const SignatureRecordsStackName = 'SignatureRecords';

// start Wallet connect nest stack

export const WalletConnectStackName = 'WalletConnect';

export const WalletConnectingStackName = 'WalletConnecting';
export const WalletConnectProposalStackName = 'WalletConnectProposal';
export const WalletConnectSessionsStackName = 'WalletConnectSessions';
export const WalletConnectSignMessageStackName = 'WalletConnectSignMessage';
export const WalletConnectTransactionStackName = 'WalletConnectTransaction';

export type WalletConnectParamList = {
  [WalletConnectingStackName]: undefined;
  [WalletConnectProposalStackName]: IWCSessionProposalEventData & { connectedNetworks: Array<{ icon: string; name: string; netId: number; id: string }> };
  [WalletConnectSessionsStackName]: undefined;
  [WalletConnectSignMessageStackName]: IWCSignMessageEventData;
  [WalletConnectTransactionStackName]: IWCSendTransactionEventData & { isContract: boolean };
  [PasswordVerifyStackName]: undefined;
};

// end Wallet connect nest stack

export type RootStackParamList = {
  [WelcomeStackName]: undefined;
  [WayToInitWalletStackName]: undefined;
  [PasswordWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [BiometricsWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [HomeStackName]: undefined;
  [AccountManagementStackName]: undefined;
  [AccountSettingStackName]: { accountId: string };
  [GroupSettingStackName]: { groupId: string };
  [HDSettingStackName]: { groupId: string };
  [BackupStackName]: NavigatorScreenParams<BackupStackParamList>;
  [SendTransactionStackName]: NavigatorScreenParams<SendTransactionParamList>;
  [NetworkManagementStackName]: undefined;
  [PasswordVerifyStackName]: undefined;
  [ScanQRCodeStackName]: undefined;
  [ReceiveStackName]: undefined;
  [EraseAllWalletStackName]: undefined;
  [AddAnotherWalletStackName]: undefined;
  [SettingsStackName]: undefined;
  [AboutUsStackName]: undefined;
  [PreferencesStackName]: undefined;
  [AppearanceStackName]: undefined;
  [LanguageStackName]: undefined;
  [WalletConnectStackName]: NavigatorScreenParams<WalletConnectParamList>;
  [SignatureRecordsStackName]: undefined;
};

export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type StackNavigation = NavigationProp<RootStackParamList>;

// SheetBottomOption
export const SheetBottomOption = { headerShown: false, presentation: 'transparentModal' as const, safeAreaInsets: { top: 0 }, animation: 'fade' as const };

// backup nest stack
export const BackupStep1StackName = 'BackupStep1';
export const BackupStep2StackName = 'BackupStep2';
export const BackupStep3StackName = 'BackupStep3';
export const BackupSuccessStackName = 'BackupSuccess';
export type BackupStackParamList = {
  [BackupStep1StackName]: { accountId?: string; groupId?: string };
  [BackupStep2StackName]: { accountId?: string; groupId?: string };
  [BackupStep3StackName]: { phrases: string[]; vaultId: string };
  [BackupSuccessStackName]: undefined;
  // navigate to home
  [HomeStackName]: undefined;
  [PasswordVerifyStackName]: undefined;
};
export type BackupScreenProps<T extends keyof BackupStackParamList> = NativeStackScreenProps<BackupStackParamList, T>;
// end backup nest stack

// SendTransaction nest stack
export const SendTransactionStep1StackName = 'SendTransactionStep1';
export const SendTransactionStep2StackName = 'SendTransactionStep2';
export const SendTransactionStep3StackName = 'SendTransactionStep3';
export const SendTransactionStep4StackName = 'SendTransactionStep4';
export type SendTransactionParamList = {
  [SendTransactionStep1StackName]: undefined;
  [SendTransactionStep2StackName]: { recipientAddress: string; searchAddress?: string };
  [SendTransactionStep3StackName]: { asset: AssetInfo; recipientAddress: string; nftItemDetail?: NFTItemDetail; amount?: string };
  [SendTransactionStep4StackName]: { asset: AssetInfo; recipientAddress: string; amount: string; nftItemDetail?: NFTItemDetail };
  // navigate to home
  [HomeStackName]: undefined;
  [PasswordVerifyStackName]: undefined;
};
export type SendTransactionScreenProps<T extends keyof SendTransactionParamList> = NativeStackScreenProps<SendTransactionParamList, T>;
// end SendTransaction nest stack
