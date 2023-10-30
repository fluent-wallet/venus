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
import { LockStackName } from '@pages/Lock';
import { SendStackName } from '@pages/Send';
import { TransactionConfirmStackName } from '@pages/Send/TransactionConfirm';

export {
  WelcomeStackName,
  SetPasswordStackName,
  BiometricsStackName,
  WalletStackName,
  ImportWalletStackName,
  AccountManageStackName,
  AccountSelectStackName,
  AddAccountStackName,
  LoginStackName,
  LockStackName,
  SendStackName,
  TransactionConfirmStackName,
};

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
  [SendStackName]: undefined;
  [TransactionConfirmStackName]: undefined;

  Home: { screen: typeof WalletStackName };
};

export type StackNavigation = NavigationProp<RootStackList>;
