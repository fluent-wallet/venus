import type { Web3WalletTypes } from '@walletconnect/web3wallet';
import type { ProposalTypes } from '@walletconnect/types';
import type { BuildApprovedNamespacesParams, SdkErrorKey } from '@walletconnect/utils';

export enum WalletConnectRPCMethod {
  //   Sign = 'eth_sign',
  PersonalSign = 'personal_sign',
  SignTypedData = 'eth_signTypedData',
  SignTypedDataV1 = 'eth_signTypedData_v1',
  SignTypedDataV3 = 'eth_signTypedData_v3',
  SignTypedDataV4 = 'eth_signTypedData_v4',
  SendTransaction = 'eth_sendTransaction',
}

export enum WalletConnectPluginEventType {
  LOADING = 'loading',
  SESSION_PROPOSAL = 'session_proposal',
  SIGN_MESSAGE = 'sign_message',
  SEND_TRANSACTION = 'sendTransaction',
}
export interface IWCLoadingEvent {
  type: WalletConnectPluginEventType.LOADING;
  data: boolean;
}

export interface IWCSessionProposalEventData {
  metadata: Web3WalletTypes.Metadata;
  requiredNamespaces: ProposalTypes.RequiredNamespaces;
  optionalNamespaces: ProposalTypes.OptionalNamespaces;
  approve: (args: Omit<BuildApprovedNamespacesParams['supportedNamespaces'][string], 'methods' | 'events'>) => Promise<void>;
  reject: (reason?: SdkErrorKey) => Promise<void>;
}

export interface IWCProposalEvent {
  type: WalletConnectPluginEventType.SESSION_PROPOSAL;
  data: IWCSessionProposalEventData;
}

export interface IWCSignMessageEventData {
  chainId: string;
  method: WalletConnectRPCMethod;
  address: string;
  message: string;
  metadata: Web3WalletTypes.Metadata;
  approve: (signedMessage: string) => Promise<void>;
  reject: (reason: string) => Promise<void>;
}

export interface IWCSignMessageEvent {
  type: WalletConnectPluginEventType.SIGN_MESSAGE;
  data: IWCSignMessageEventData;
}

export interface IWCSendTransactionData {
  chainId: string;
  method: WalletConnectRPCMethod;
  address: string;
  tx: {
    from: string;
    to?: string;
    value?: bigint;
    data?: string;
    nonce?: number;
    gasLimit?: bigint;
    gasPrice?: bigint;
  };
  metadata: WalletConnectMetadata;
  approve: (txhash: string) => Promise<void>;
  reject: (reason: string) => Promise<void>;
}
export interface IWCSendTransactionEvent {
  type: WalletConnectPluginEventType.SEND_TRANSACTION;
  data: IWCSendTransactionData;
}
export type WalletConnectPluginEvents = IWCProposalEvent | IWCLoadingEvent | IWCSignMessageEvent | IWCSendTransactionEvent;

export type WalletConnectMetadata = Web3WalletTypes.Metadata;
