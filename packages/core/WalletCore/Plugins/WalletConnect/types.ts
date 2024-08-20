import type { ProposalTypes } from '@walletconnect/types';
import type { NetworkType } from '../ReactInject';
import type { SdkErrorKey } from '@walletconnect/utils';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export enum WalletConnectRPCMethod {
  //   Sign = 'eth_sign',
  PersonalSign = 'personal_sign',
  SignTypedData = 'eth_signTypedData',
  SignTypedDataV1 = 'eth_signTypedData_v1',
  SignTypedDataV3 = 'eth_signTypedData_v3',
  SignTypedDataV4 = 'eth_signTypedData_v4',
  SendTransaction = 'eth_sendTransaction',
  ConfluxSendTransaction = 'cfx_sendTransaction',
  ConfluxSignTypedData = 'cfx_signTypedData',
}

export enum WalletConnectPluginEventType {
  LOADING = 'loading',
  SESSION_PROPOSAL = 'sessionProposal',
  SIGN_MESSAGE = 'signMessage',
  SEND_TRANSACTION = 'sendTransaction',
}

export interface IWCSessionProposalEventData {
  metadata: Web3WalletTypes.Metadata;
  requiredNamespaces: ProposalTypes.RequiredNamespaces;
  optionalNamespaces: ProposalTypes.OptionalNamespaces;
  connectedNetworks: Array<{
    icon: string;
    name: string;
    netId: number;
    id: string;
    networkType: NetworkType;
  }>;
}

export interface IWCSessionProposalEvent {
  type: WalletConnectPluginEventType.SESSION_PROPOSAL;
  data: IWCSessionProposalEventData;
  action: {
    approve: () => Promise<void>;
    reject: (reason?: SdkErrorKey) => Promise<void>;
  };
}

export interface IWCSignMessageEventData {
  chainId: string;
  method: WalletConnectRPCMethod;
  message: string;
  metadata: Web3WalletTypes.Metadata;
}

export interface IWCSignMessageEvent {
  type: WalletConnectPluginEventType.SIGN_MESSAGE;
  data: IWCSignMessageEventData;
  action: {
    approve: (signedMessage: string) => Promise<void>;
    reject: (reason?: string) => Promise<void>;
  };
}

export interface IWCSendTransactionEventData {
  chainId: string;
  method: WalletConnectRPCMethod;
  tx: {
    from: string;
    to?: string;
    value?: bigint;
    data?: string;
    nonce?: number;
    gas?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    type?: number;
    storageLimit?: string;
  };
  metadata: WalletConnectMetadata;
}
export interface IWCSendTransactionEvent {
  type: WalletConnectPluginEventType.SEND_TRANSACTION;
  data: IWCSendTransactionEventData;
  action: {
    approve: (txhash: string) => Promise<void>;
    reject: (reason?: string) => Promise<void>;
  };
}
export type WalletConnectPluginEvents = IWCSessionProposalEvent | IWCSignMessageEvent | IWCSendTransactionEvent;

export type WalletConnectMetadata = Web3WalletTypes.Metadata;
