import { type NavigationProp } from '@react-navigation/native';

const WelcomeStackName = 'Welcome';
const WayToInitWalletStackName = 'WayToInitWallet';
const PasswordWayStackName = 'PasswordWay';
const BiometricsWayStackName = 'Biometrics';
const HomeStackName = 'Home';

export { WelcomeStackName, WayToInitWalletStackName, HomeStackName };

export type RootStackParamList = {
  [WelcomeStackName]: undefined;
  [WayToInitWalletStackName]: undefined;
  [PasswordWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [BiometricsWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [HomeStackName]: undefined;
};

export type StackScreenProps<T extends keyof RootStackParamList> = NavigationProp<RootStackParamList, T>;
