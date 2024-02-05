import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const WelcomeStackName = 'Welcome';
const WayToInitWalletStackName = 'WayToInitWallet';
const BiometricsWayStackName = 'Biometrics';
const PasswordWayStackName = 'PasswordWay';
const HomeStackName = 'Home';
const SettingsStackName = 'Settings';

export { WelcomeStackName, WayToInitWalletStackName, HomeStackName, BiometricsWayStackName, PasswordWayStackName, SettingsStackName };

export type RootStackParamList = {
  [WelcomeStackName]: undefined;
  [WayToInitWalletStackName]: undefined;
  [PasswordWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [BiometricsWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [HomeStackName]: undefined;
  [SettingsStackName]: undefined
};

export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
