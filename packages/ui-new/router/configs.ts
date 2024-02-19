import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const WelcomeStackName = 'Welcome';
const WayToInitWalletStackName = 'WayToInitWallet';
const BiometricsWayStackName = 'Biometrics';
const PasswordWayStackName = 'PasswordWay';
const HomeStackName = 'Home';
const SettingsStackName = 'Settings';
const AccountManagementStackName = 'WalletManagement';
const NetworkManagementStackName = 'NetworkManagement';

export {
  WelcomeStackName,
  WayToInitWalletStackName,
  HomeStackName,
  BiometricsWayStackName,
  PasswordWayStackName,
  SettingsStackName,
  AccountManagementStackName,
  NetworkManagementStackName,
};

export type RootStackParamList = {
  [WelcomeStackName]: undefined;
  [WayToInitWalletStackName]: undefined;
  [PasswordWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [BiometricsWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [HomeStackName]: undefined;
  [SettingsStackName]: undefined;
  [AccountManagementStackName]: undefined;
  [NetworkManagementStackName]: undefined;
};

export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
