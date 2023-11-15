import { type NavigationProp } from '@react-navigation/native';
import { WelcomeStackName } from '@pages/Welcome';
import { SetPasswordStackName } from '@pages/SetPassword';
import { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import { WalletStackName } from '@pages/Wallet';
import { ImportWalletStackName } from '@pages/ImportWallet';
import { AccountManageStackName } from '@pages/Account/AccountManage';
import { AccountSelectStackName } from '@pages/Account/AccountSelect';
import { AddAccountStackName } from '@pages/Account/AddAccount';
import { GroupSettingStackName } from '@pages/Account/Setting/GroupSetting';
import { AccountSettingStackName } from '@pages/Account/Setting/AccountSetting';
import { HDManageStackName } from '@pages/Account/Setting/HDManage';
import { LoginStackName } from '@pages/Login';
import { LockStackName } from '@pages/Lock';
import { ReceiveAddressStackName } from '@pages/Transaction/ReceiveAddress';
import { SendToStackName } from '@pages/Transaction/SendTo';
import { TransactionConfirmStackName } from '@pages/Transaction/TransactionConfirm';
import { TokensStackName } from '@pages/Transaction/Tokens';
import { BackUpStackName } from '@pages/Account/BackUp';
import { ReceiveStackName } from '@pages/Receive';
import { SetAmountStackName } from '@pages/Receive/SetAmount';
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
  TokensStackName,
  BackUpStackName,
  AccountSettingStackName,
  GroupSettingStackName,
  ReceiveStackName,
  SetAmountStackName,
  HDManageStackName,
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
  [HDManageStackName]: { accountGroupId: string };
  [WalletStackName]: undefined;
  [LoginStackName]: undefined;
  [LockStackName]: undefined;
  [AddAccountStackName]: { type?: 'add' | 'create' };
  [AccountSelectStackName]: undefined;
  [TokensStackName]: undefined;
  [SendToStackName]: undefined;
  [TransactionConfirmStackName]: undefined;
  [ReceiveAddressStackName]: undefined;

  [BackUpStackName]: { vaultId: string; accountIndex?: number };
  [ReceiveStackName]: undefined;
  [SetAmountStackName]: undefined;

  Home: { screen: typeof WalletStackName };
};

export type StackNavigation = NavigationProp<RootStackList>;
