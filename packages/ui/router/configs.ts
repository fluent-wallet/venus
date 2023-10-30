import { type NavigationProp } from '@react-navigation/native';
import { WelcomeStackName } from '@pages/Welcome';
import { SetPasswordStackName } from '@pages/SetPassword';
import { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import { WalletStackName } from '@pages/Wallet';
import { ImportWalletStackName } from '@pages/ImportWallet';
import { AccountManageStackName } from '@pages/Account/AccountManage';
import { AccountSelectStackName } from '@pages/Account/AccountSelect';
import { AddAccountStackName } from '@pages/Account/AddAccount';
import { LoginStackName } from '@pages/Login';
import { LockStackName } from './configs';
export { AccountManageStackName } from '@pages/Account/AccountManage';
export { AccountSelectStackName } from '@pages/Account/AccountSelect';
export { AddAccountStackName } from '@pages/Account/AddAccount';
export { ImportWalletStackName } from '@pages/ImportWallet';
export { SetPasswordStackName } from '@pages/SetPassword';
export { BiometricsStackName } from '@pages/SetPassword/Biometrics';
export { SettingsStackName } from '@pages/Settings';
export { WalletStackName } from '@pages/Wallet';
export { WelcomeStackName } from '@pages/Welcome';
export { LoginStackName } from '@pages/Login';
export { LockStackName } from '@pages/Lock';
export const HomeStackName = 'Home';

export type RootStackList = {
  [WelcomeStackName]: undefined;
  [SetPasswordStackName]?: { type?: 'importPrivateKey' | 'importSeedPhrase' | 'create' | 'BSIM'; value?: string };
  [BiometricsStackName]?: { type?: 'importPrivateKey' | 'importSeedPhrase' | 'create' | 'BSIM'; value?: string };
  [ImportWalletStackName]: { type?: 'add' | 'create' };
  [AccountManageStackName]: undefined;
  [WalletStackName]: undefined;
  [LoginStackName]: undefined;
  [LockStackName]: undefined;
  [AddAccountStackName]: { type?: 'add' | 'create' };
  [AccountSelectStackName]: undefined;

  Home: { screen: typeof WalletStackName };
};

export type StackNavigation = NavigationProp<RootStackList>;
