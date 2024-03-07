import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { type NFTItemDetail } from '@core/WalletCore/Plugins/NFTDetailTracker';

export const WelcomeStackName = 'Welcome';
export const WayToInitWalletStackName = 'WayToInitWallet';
export const BiometricsWayStackName = 'Biometrics';
export const PasswordWayStackName = 'PasswordWay';
export const HomeStackName = 'Home';
export const SettingsStackName = 'Settings';
export const AccountManagementStackName = 'WalletManagement';
export const AccountSettingStackName = 'AccountSetting';
export const GroupSettingStackName = 'GroupSettin';
export const HDSettingStackName = 'HDSetting';
export const BackupStackName = 'Backup';
export const NetworkManagementStackName = 'NetworkManagement';
export const PasswordVerifyStackName = 'PasswordVerify';
export const SendTranscationStackName = 'SendTranscation';
export const ScanQRCodeStackName = 'ScanQRCode';

export type RootStackParamList = {
  [WelcomeStackName]: undefined;
  [WayToInitWalletStackName]: undefined;
  [PasswordWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [BiometricsWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [HomeStackName]: undefined;
  [SettingsStackName]: undefined;
  [AccountManagementStackName]: undefined;
  [AccountSettingStackName]: { accountId: string };
  [GroupSettingStackName]: { groupId: string };
  [HDSettingStackName]: { groupId: string };
  [BackupStackName]: NavigatorScreenParams<BackupStackParamList>;
  [SendTranscationStackName]: NavigatorScreenParams<SendTranscationParamList>;
  [NetworkManagementStackName]: undefined;
  [PasswordVerifyStackName]: undefined;
  [ScanQRCodeStackName]: undefined;
};

export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type StackNavigation = NavigationProp<RootStackParamList>;

// SheetBottomOption
export const SheetBottomOption = { headerShown: false, presentation: 'transparentModal' as const, safeAreaInsets: { top: 0 } };

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
};
export type BackupScreenProps<T extends keyof BackupStackParamList> = NativeStackScreenProps<BackupStackParamList, T>;
// end backup nest stack

// sendTranscation nest stack
export const SendTranscationStep1StackName = 'SendTranscationStep1';
export const SendTranscationStep2StackName = 'SendTranscationStep2';
export const SendTranscationStep3StackName = 'SendTranscationStep3';
export const SendTranscationStep4StackName = 'SendTranscationStep4';
export type SendTranscationParamList = {
  [SendTranscationStep1StackName]: undefined;
  [SendTranscationStep2StackName]: { targetAddress: string };
  [SendTranscationStep3StackName]: { asset: AssetInfo; targetAddress: string; nftItemDetail?: NFTItemDetail };
  [SendTranscationStep4StackName]: { asset: AssetInfo; targetAddress: string; amount: string; nftItemDetail?: NFTItemDetail };
  // navigate to home
  [HomeStackName]: undefined;
};
export type SendTranscationScreenProps<T extends keyof SendTranscationParamList> = NativeStackScreenProps<SendTranscationParamList, T>;
// end sendTranscation nest stack
