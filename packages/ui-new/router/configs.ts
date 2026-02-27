import type { HardwareUnavailableReason as BSIMHardwareReason } from '@core/hardware/bsim/types';
import type { ExternalRequestSnapshot } from '@core/modules/externalRequests';
import type { SpeedUpAction } from '@core/types';
import type { NetworkType } from '@core/utils/consts';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import type { NFTItemDetail } from '@core/WalletCore/Plugins/NFTDetailTracker/server';
import type { IWCSendTransactionEventData, IWCSessionProposalEventData, IWCSignMessageEventData } from '@core/WalletCore/Plugins/WalletConnect/types';
import type { SpeedUpLevel } from '@modules/GasFee/GasFeeSetting';
import type { VersionJSON } from '@pages/Settings/AboutUs';
import type { NavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export const WelcomeStackName = 'Welcome';
export const WayToInitWalletStackName = 'WayToInitWallet';
export const ChangeBPinStackName = 'ChangeBPin';
export const RecoverBsimStackName = 'RecoverBsim';
export const BiometricsWayStackName = 'Biometrics';
export const PasswordWayStackName = 'PasswordWay';
export const HomeStackName = 'Home';
export const AccountManagementStackName = 'WalletManagement';
export const AccountSettingStackName = 'AccountSetting';
export const GroupSettingStackName = 'GroupSettin';
export const HDSettingStackName = 'HDSetting';
export const BackupStackName = 'Backup';
export const NetworkManagementStackName = 'NetworkManagement';
export const NetworkAddNewEndpointStackName = 'NetworkAddNewEndpoint';
export const PasswordVerifyStackName = 'PasswordVerify';
export const SendTransactionStackName = 'SendTransaction';
export const ReceiveStackName = 'Receive';
export const EraseAllWalletStackName = 'EraseAllWallet';
export const AddAnotherWalletStackName = 'AddAnotherWallet';
export const SettingsStackName = 'Settings';
export const AboutUsStackName = 'AboutUs';
export const UpdateVersionStackName = 'UpdateVersion';
export const PreferencesStackName = 'Preferences';
export const AppearanceStackName = 'Appearance';
export const LanguageStackName = 'Language';
export const SignatureRecordsStackName = 'SignatureRecords';
export const SpeedUpStackName = 'SpeedUp';
export const TransactionDetailStackName = 'TransactionDetail';
export const ExternalInputHandlerStackName = 'ExternalInputHandler';
export const TooManyPendingStackName = 'TooManyPending';
export const BSIMAvailabilityStackName = 'BSIMAvailability';

// start Wallet connect nest stack

export const WalletConnectStackName = 'WalletConnect';

export const WalletConnectProposalStackName = 'WalletConnectProposal';
export const WalletConnectSessionsStackName = 'WalletConnectSessions';
export const WalletConnectSignMessageStackName = 'WalletConnectSignMessage';
export const WalletConnectTransactionStackName = 'WalletConnectTransaction';

type RuntimeWcProposalParams = {
  requestId: string;
  request: Extract<ExternalRequestSnapshot, { provider: 'wallet-connect'; kind: 'session_proposal' }>;
};

type RuntimeWcSessionRequest = Extract<ExternalRequestSnapshot, { provider: 'wallet-connect'; kind: 'session_request' }>;

type RuntimeWcSignMessageParams = {
  requestId: string;
  request: RuntimeWcSessionRequest & { method: 'personal_sign' | 'eth_signTypedData_v4' };
};

type RuntimeWcSendTxParams = {
  requestId: string;
  request: RuntimeWcSessionRequest & { method: 'eth_sendTransaction' };
};
export type WalletConnectParamList = {
  [WalletConnectProposalStackName]:
    | (IWCSessionProposalEventData & {
        connectedNetworks: Array<{ icon: string; name: string; netId: number; id: string; networkType: NetworkType }>;
      })
    | RuntimeWcProposalParams;

  [WalletConnectSessionsStackName]: undefined;

  [WalletConnectSignMessageStackName]: IWCSignMessageEventData | RuntimeWcSignMessageParams;

  [WalletConnectTransactionStackName]: (IWCSendTransactionEventData & { isContract: boolean }) | RuntimeWcSendTxParams;

  [PasswordVerifyStackName]: undefined | { requestId: string };
};

// end Wallet connect nest stack

export type RootStackParamList = {
  [WelcomeStackName]: undefined;
  [WayToInitWalletStackName]: undefined;
  [RecoverBsimStackName]: undefined;
  [ChangeBPinStackName]: undefined;
  [PasswordWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [BiometricsWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string };
  [HomeStackName]: undefined;
  [AccountManagementStackName]: undefined;
  [AccountSettingStackName]: { accountId: string };
  [GroupSettingStackName]: { groupId: string };
  [HDSettingStackName]: { groupId: string };
  [BackupStackName]: NavigatorScreenParams<BackupStackParamList>;
  [SendTransactionStackName]: NavigatorScreenParams<SendTransactionParamList>;
  [NetworkManagementStackName]: undefined;
  [PasswordVerifyStackName]: undefined | { requestId: string };
  [ReceiveStackName]: undefined;
  [EraseAllWalletStackName]: undefined;
  [AddAnotherWalletStackName]: undefined;
  [SettingsStackName]: undefined;
  [AboutUsStackName]: undefined;
  [UpdateVersionStackName]: { newVersion: VersionJSON };
  [PreferencesStackName]: undefined;
  [AppearanceStackName]: undefined;
  [LanguageStackName]: undefined;
  [WalletConnectStackName]: NavigatorScreenParams<WalletConnectParamList>;
  [NetworkAddNewEndpointStackName]: undefined;
  [SignatureRecordsStackName]: undefined;
  [SpeedUpStackName]: { txId: string; type: SpeedUpAction; level?: SpeedUpLevel };
  [TransactionDetailStackName]: { txId: string };
  [ExternalInputHandlerStackName]: { data: string } | undefined;
  [TooManyPendingStackName]: undefined;
  [BSIMAvailabilityStackName]: { reason?: BSIMHardwareReason };
};

export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type StackNavigation = NavigationProp<RootStackParamList>;

// SheetBottomOption
export const SheetBottomOption = { headerShown: false, presentation: 'transparentModal' as const, safeAreaInsets: { top: 0 }, animation: 'fade' as const };

// backup nest stack
export const BackupStep1StackName = 'BackupStep1';
export const BackupStep2StackName = 'BackupStep2';
export const BackupStep3StackName = 'BackupStep3';
export const BackupSuccessStackName = 'BackupSuccess';
export const BackupBSIM1PasswordStackName = 'BackupBSIMPassword';
export const BackupBSIMQ2RCodeStackName = 'BackupBSIMQRCode';
export type BackupStackParamList = {
  [BackupStep1StackName]: { accountId?: string; groupId?: string };
  [BackupStep2StackName]: { accountId?: string; groupId?: string };
  [BackupStep3StackName]: { phrases: string[]; vaultId: string };
  [BackupBSIM1PasswordStackName]: { vaultId: string };
  [BackupBSIMQ2RCodeStackName]: { backupPassword: string; seedData: string; vaultId: string };
  [BackupSuccessStackName]: undefined;
  // navigate to home
  [HomeStackName]: undefined;
  [PasswordVerifyStackName]: undefined | { requestId: string };
};
export type BackupScreenProps<T extends keyof BackupStackParamList> = NativeStackScreenProps<BackupStackParamList, T>;
// end backup nest stack

// SendTransaction nest stack
export const SendTransactionStep1StackName = 'SendTransactionStep1';
export const SendTransactionStep2StackName = 'SendTransactionStep2';
export const SendTransactionStep3StackName = 'SendTransactionStep3';
export const SendTransactionStep4StackName = 'SendTransactionStep4';
export type SendTransactionParamList = {
  [SendTransactionStep1StackName]: undefined;
  [SendTransactionStep2StackName]: { recipientAddress: string; searchAddress?: string };
  [SendTransactionStep3StackName]: { asset: AssetInfo; recipientAddress: string; nftItemDetail?: NFTItemDetail; amount?: string };
  [SendTransactionStep4StackName]: { asset: AssetInfo; recipientAddress: string; amount: string; nftItemDetail?: NFTItemDetail; inMaxMode?: boolean };
  // navigate to home
  [HomeStackName]: undefined;
  [PasswordVerifyStackName]: undefined | { requestId: string };
};
export type SendTransactionScreenProps<T extends keyof SendTransactionParamList> = NativeStackScreenProps<SendTransactionParamList, T>;
// end SendTransaction nest stack
