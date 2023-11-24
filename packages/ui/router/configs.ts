import { type NavigationProp } from '@react-navigation/native';

const HomeStackName = 'Home';

const WelcomeStackName = 'Welcome';
const SetPasswordStackName = 'SetPassword';
const BiometricsStackName = 'Biometrics';
const WalletStackName = 'Wallet';
const ImportWalletStackName = 'ImportSeed';
const AccountManageStackName = 'AccountManage';
const AccountSelectStackName = 'AccountSelect';
const AddAccountStackName = 'AddNewAccount';
const LoginStackName = 'Login';
const LockStackName = 'Lock';
const SendToStackName = 'SendTo';
const ReceiveAddressStackName = 'ReceiveAddress';
const TransactionConfirmStackName = 'TransactionConfirm';
const TokensStackName = 'Tokens';
const BackUpStackName = 'BackUp';
const AccountSettingStackName = 'AccountSetting';
const GroupSettingStackName = 'GroupSetting';
const ReceiveStackName = 'Receive';
const SetAmountStackName = 'SetAmount';
const HDManageStackName = 'HDManage';

const ScanQRCodeStackName = 'ScanQRCode';

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
  HomeStackName,
  ScanQRCodeStackName,
};

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
  [ReceiveAddressStackName]: { address?: string };

  [BackUpStackName]: { accountGroupId: string; accountIndex?: number };
  [ReceiveStackName]: undefined;
  [SetAmountStackName]: undefined;
  [ScanQRCodeStackName]: { path: keyof RootStackList };

  Home: { screen: typeof WalletStackName };
};

export type StackNavigation = NavigationProp<RootStackList>;
