import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationProp } from '@react-navigation/native';

const WelcomeStackName = 'Welcome';
const WayToInitWalletStackName = 'WayToInitWallet';
const BiometricsWayStackName = 'Biometrics';
const PasswordWayStackName = 'PasswordWay';
const HomeStackName = 'Home';
const SettingsStackName = 'Settings';
const AccountManagementStackName = 'WalletManagement';
const AccountSettingStackName = 'AccountSetting';
const GroupSettingStackName = 'GroupSettin';
const HDSettingStackName = 'HDSetting';
const BackupStackName = 'Backup';
const NetworkManagementStackName = 'NetworkManagement';
const PasswordVerifyStackName = 'PasswordVerify';

export {
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
  BackupStackName,
  NetworkManagementStackName,
  PasswordVerifyStackName,
};

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
  [BackupStackName]: { accountId?: string; groupId?: string };
  [NetworkManagementStackName]: undefined;
  [PasswordVerifyStackName]: undefined;
};

export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type StackNavigation = NavigationProp<RootStackParamList>;
