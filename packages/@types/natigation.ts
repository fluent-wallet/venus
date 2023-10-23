import { WelcomeStackName } from '@pages/Welcome';
import { SetPasswordStackName } from '@pages/SetPassword';
import { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import { WalletStackName } from '@pages/Wallet';
import { CreateAccountStackName } from '@pages/CreateAccount';
import { AccountManageStackName } from '@pages/AccountManage';
import { NavigationProp } from '@react-navigation/native';

export type RootStackList = {
  [WelcomeStackName]: undefined;
  [SetPasswordStackName]: undefined;
  [BiometricsStackName]: undefined;
  [CreateAccountStackName]: undefined;
  [AccountManageStackName]: undefined;
  [WalletStackName]: undefined;

  'Home': {screen: typeof WalletStackName}
};

export type StackNavigation = NavigationProp<RootStackList>;
