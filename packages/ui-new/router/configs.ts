import { SHEET_CORNER_RADIUS } from '@components/Sheet/constants';
import type { HardwareUnavailableReason as BSIMHardwareReason } from '@core/hardware/bsim/types';
import type { ExternalRequestSnapshot } from '@core/modules/externalRequests';
import type { SpeedUpAction } from '@core/types';
import type { SpeedUpLevel } from '@modules/GasFee/GasFeeSetting';
import type { VersionJSON } from '@pages/Settings/AboutUs';
import type { NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationOptions, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { INftItem } from '@service/core';
import type { AssetInfo } from '@utils/assetInfo';

export const WelcomeStackName = 'Welcome';
export const WayToInitWalletStackName = 'WayToInitWallet';
export const ChangeBPinStackName = 'ChangeBPin';
export const RecoverBsimStackName = 'RecoverBsim';
export const BiometricsWayStackName = 'Biometrics';
export const PasswordWayStackName = 'PasswordWay';
export const HomeStackName = 'Home';
export const AccountManagementStackName = 'WalletManagement';
export const AccountSelectorStackName = 'AccountSelector';
export const AccountSettingStackName = 'AccountSetting';
export const GroupSettingStackName = 'GroupSettin';
export const HDSettingStackName = 'HDSetting';
export const NetworkManagementStackName = 'NetworkManagement';
export const NetworkAddNewEndpointStackName = 'NetworkAddNewEndpoint';
export const PasswordVerifyStackName = 'PasswordVerify';
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
  request: RuntimeWcSessionRequest & { method: 'personal_sign' | 'eth_signTypedData' | 'eth_signTypedData_v3' | 'eth_signTypedData_v4' };
};

type RuntimeWcSendTxParams = {
  requestId: string;
  request: RuntimeWcSessionRequest & { method: 'eth_sendTransaction' };
  isContract: boolean;
};
export type RootStackParamList = {
  [WelcomeStackName]: undefined;
  [WayToInitWalletStackName]: undefined;
  [RecoverBsimStackName]: undefined | { bsimDeviceId?: string };
  [ChangeBPinStackName]: undefined | { bsimDeviceId?: string };
  [PasswordWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string; bsimDeviceId?: string };
  [BiometricsWayStackName]?: { type?: 'importExistWallet' | 'createNewWallet' | 'connectBSIM'; value?: string; bsimDeviceId?: string };
  [HomeStackName]: undefined;
  [AccountManagementStackName]: undefined | { fromAccountSelector: true };
  [AccountSelectorStackName]: undefined;
  [AccountSettingStackName]: { accountId: string };
  [GroupSettingStackName]: { groupId: string };
  [HDSettingStackName]: { groupId: string };
  [BackupStep1StackName]: { accountId?: string; groupId?: string };
  [BackupStep2StackName]: { accountId?: string; groupId?: string };
  [BackupStep3StackName]: { phrases: string[]; vaultId: string };
  [BackupSuccessStackName]: undefined;
  [BackupBSIM1PasswordStackName]: { vaultId: string };
  [BackupBSIMQ2RCodeStackName]: { backupPassword: string; seedData: string; vaultId: string };
  [SendTransactionStep1StackName]: undefined;
  [SendTransactionStep2StackName]: { recipientAddress: string; searchAddress?: string };
  [SendTransactionStep3StackName]: { asset: AssetInfo; recipientAddress: string; nftItemDetail?: INftItem; amount?: string };
  [SendTransactionStep4StackName]: { asset: AssetInfo; recipientAddress: string; amount: string; nftItemDetail?: INftItem; inMaxMode?: boolean };
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
  [WalletConnectProposalStackName]: RuntimeWcProposalParams;
  [WalletConnectSignMessageStackName]: RuntimeWcSignMessageParams;
  [WalletConnectTransactionStackName]: RuntimeWcSendTxParams;
  [WalletConnectSessionsStackName]: undefined;
  [NetworkAddNewEndpointStackName]: undefined;
  [SignatureRecordsStackName]: undefined;
  [SpeedUpStackName]: { txId: string; type: SpeedUpAction; level?: SpeedUpLevel };
  [TransactionDetailStackName]: { txId: string };
  [ExternalInputHandlerStackName]: { data: string } | undefined;
  [TooManyPendingStackName]: undefined | { requestId?: string };
  [BSIMAvailabilityStackName]: { reason?: BSIMHardwareReason };
};

export type StackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type StackNavigation = NavigationProp<RootStackParamList>;

// SheetBottomOption
export const SheetBottomOption = { headerShown: false, presentation: 'transparentModal' as const, safeAreaInsets: { top: 0 }, animation: 'none' as const };

export function getFormSheetOptions(
  backgroundColor: string,
  sheetAllowedDetents: NativeStackNavigationOptions['sheetAllowedDetents'] = 'fitToContents',
): NativeStackNavigationOptions {
  return {
    headerShown: false,
    presentation: 'formSheet',
    sheetAllowedDetents,
    sheetCornerRadius: SHEET_CORNER_RADIUS,
    contentStyle: { backgroundColor },
  };
}

// Backup routes
export const BackupStep1StackName = 'BackupStep1';
export const BackupStep2StackName = 'BackupStep2';
export const BackupStep3StackName = 'BackupStep3';
export const BackupSuccessStackName = 'BackupSuccess';
export const BackupBSIM1PasswordStackName = 'BackupBSIMPassword';
export const BackupBSIMQ2RCodeStackName = 'BackupBSIMQRCode';

// SendTransaction routes
export const SendTransactionStep1StackName = 'SendTransactionStep1';
export const SendTransactionStep2StackName = 'SendTransactionStep2';
export const SendTransactionStep3StackName = 'SendTransactionStep3';
export const SendTransactionStep4StackName = 'SendTransactionStep4';
