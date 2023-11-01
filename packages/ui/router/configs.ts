import { type NavigationProp } from '@react-navigation/native';
import { WelcomeStackName } from '@pages/Welcome';
import { SetPasswordStackName } from '@pages/SetPassword';
import { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import { WalletStackName } from '@pages/Wallet';
import { ImportWalletStackName } from '@pages/ImportWallet';
import { AccountManageStackName } from '@pages/Account/AccountManage';
import { AccountSelectStackName } from '@pages/Account/AccountSelect';
import { AddAccountStackName } from '@pages/Account/AddAccount';
import { GroupSettingStackName } from '@pages/Account/GroupSetting';
import { AccountSettingStackName } from '@pages/Account/AccountSetting';
import { LoginStackName } from '@pages/Login';
import { LockStackName } from '@pages/Lock';
import { ReceiveAddressStackName } from '@pages/Transaction/ReceiveAddress';
import { SendToStackName } from '@pages/Transaction/SendTo';
import { TransactionConfirmStackName } from '@pages/Transaction/TransactionConfirm';
import { TokenListStackName } from '@pages/Transaction/TokenList';
import { BackUpStackName } from '@pages/Account/BackUp';
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
  SendToStackName,
  ReceiveAddressStackName,
  TransactionConfirmStackName,
  TokenListStackName,
  BackUpStackName,
  AccountSettingStackName,
  GroupSettingStackName,
};

export const HomeStackName = 'Home';

export type RootStackList = {
  [WelcomeStackName]: undefined;
  [SetPasswordStackName]?: { type?: 'importPrivateKey' | 'importSeedPhrase' | 'create' | 'BSIM'; value?: string };
  [BiometricsStackName]?: { type?: 'importPrivateKey' | 'importSeedPhrase' | 'create' | 'BSIM'; value?: string };
  [ImportWalletStackName]: { type?: 'add' | 'create' };
  [AccountManageStackName]: undefined;
  [AccountSettingStackName]: { accountId: string };
  [GroupSettingStackName]: { accountGroupId: string };
  [WalletStackName]: undefined;
  [LoginStackName]: undefined;
  [LockStackName]: undefined;
  [AddAccountStackName]: { type?: 'add' | 'create' };
  [AccountSelectStackName]: undefined;
  [SendToStackName]: undefined;
  [TransactionConfirmStackName]: undefined;
  [ReceiveAddressStackName]: undefined;
  [TokenListStackName]: undefined;
  [BackUpStackName]: { vaultId: string };

  Home: { screen: typeof WalletStackName };
};

export type StackNavigation = NavigationProp<RootStackList>;
