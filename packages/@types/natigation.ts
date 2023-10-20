import { WelcomeStackName } from '@pages/Welcome';
import { SetPasswordStackName } from '@pages/SetPassword';
import { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import { HomeStackName } from '@pages/Home';
import { CreateAccountStackName } from '@pages/CreateAccount';
import { AccountManageStackName } from '@pages/AccountManage';
import { NavigationProp } from '@react-navigation/native';

export type RootStackList = {
  [WelcomeStackName]: undefined;
  [SetPasswordStackName]: undefined;
  [BiometricsStackName]: undefined;
  [CreateAccountStackName]: undefined;
  [AccountManageStackName]: undefined;
  [HomeStackName]: undefined;
};

export type StackNavigation = NavigationProp<RootStackList>;
