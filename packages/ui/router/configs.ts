import { RequestSubject } from '@core/WalletCore/Events/requestSubject';
import { AssetType } from '@core/database/models/Asset';
import VaultType from '@core/database/models/Vault/VaultType';
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

const BackUpNoticeStackName = 'BackUpNotice';

const BackUpVerifyStackName = 'BackUpVerify';

const WalletConnectApprovalSheetStackName = 'WalletConnectApprovalSheet';
const WalletConnectSignTransactionStackName = 'WalletConnectSignTransaction';

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
  BackUpNoticeStackName,
  BackUpVerifyStackName,
  WalletConnectApprovalSheetStackName,
  WalletConnectSignTransactionStackName,
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
  [TokensStackName]: { to: string };
  [SendToStackName]: {
    to: string;
    assetType: AssetType;
    balance: string;
    symbol: string;
    decimals: number;
    amount?: string;
    contractAddress?: string;
    iconUrl?: string;
    priceInUSDT?: string;
    nftName?: string;
    tokenId?: string;
    tokenImage?: string;
    contractName?: string;
  };
  [TransactionConfirmStackName]: {
    to: string;
    assetType: AssetType;
    balance: string;
    symbol: string;
    decimals: number;
    amount: string;
    contractAddress?: string;
    iconUrl?: string;
    priceInUSDT?: string;
    nftName?: string;
    tokenId?: string;
    tokenImage?: string;
    contractName?: string;
  };
  [ReceiveAddressStackName]: { to?: string };

  [BackUpStackName]: { accountGroupId: string; type: VaultType; accountIndex?: number };
  [ReceiveStackName]: undefined;
  [SetAmountStackName]: undefined;
  [ScanQRCodeStackName]: undefined;
  [BackUpNoticeStackName]: undefined;
  [BackUpVerifyStackName]: { seedPhrase: { index: number; word: string }[]; accountGroupId: string };

  [WalletConnectApprovalSheetStackName]: { requestId: string };
  [WalletConnectSignTransactionStackName]: { requestId: string };

  Home: { screen: typeof WalletStackName };
};

export type StackNavigation = NavigationProp<RootStackList>;
