import { type NavigationProp } from '@react-navigation/native';

const WelcomeStackName = 'Welcome';
const WayToInitWalletStackName = 'WayToInitWallet';
const HomeStackName = 'Home';

export { WelcomeStackName, WayToInitWalletStackName, HomeStackName };

export type RootStackParamList = {
  [WelcomeStackName]: undefined;
  [WayToInitWalletStackName]: undefined;
  [HomeStackName]: undefined;
};

export type StackScreenProps<T extends keyof RootStackParamList> = NavigationProp<RootStackParamList, T>;
