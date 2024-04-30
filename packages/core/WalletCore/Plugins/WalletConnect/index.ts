import { Plugin } from '@core/WalletCore/Plugins';
import { Core } from '@walletconnect/core';
import Client, { Web3Wallet, Web3WalletTypes } from '@walletconnect/web3wallet';
import { ProposalTypes } from '@walletconnect/types';
import { parseUri, getSdkError, buildApprovedNamespaces, type BuildApprovedNamespacesParams, SdkErrorKey } from '@walletconnect/utils';
import { Subject, filter } from 'rxjs';

import { WalletConnectRPCMethod } from './types';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    WalletConnect: WalletConnect;
  }
}

export const SUPPORT_SESSION_EVENTS = ['chainChanged', 'accountsChanged'];

export const SUPPORT_SIGN_METHODS = [
  WalletConnectRPCMethod.PersonalSign,
  WalletConnectRPCMethod.SignTypedData,
  WalletConnectRPCMethod.SignTypedDataV1,
  WalletConnectRPCMethod.SignTypedDataV3,
  WalletConnectRPCMethod.SignTypedDataV4,
];
export const SUPPORTED_TRANSACTION_METHODS = [WalletConnectRPCMethod.SendTransaction];
export interface WalletConnectPluginParams {
  projectId: string;
  metadata: Web3WalletTypes.Options['metadata'];
}

export interface WCProposalEventType {
  metadata: Web3WalletTypes.Metadata;
  requiredNamespaces: ProposalTypes.RequiredNamespaces;
  optionalNamespaces: ProposalTypes.OptionalNamespaces;
  approve: (args: Omit<BuildApprovedNamespacesParams['supportedNamespaces'][string], 'methods' | 'events'>) => Promise<void>;
  reject: (reason?: SdkErrorKey) => Promise<void>;
}

export class WalletConnectPluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletConnectPluginError';
  }
}

export default class WalletConnect implements Plugin {
  public name = 'WalletConnect';

  client: Promise<Client>;

  loadingSubject = new Subject<boolean>();

  sessionProposalSubject = new Subject<WCProposalEventType>();

  sessionStateChangeSubject = new Subject<void>();

  constructor({ projectId, metadata }: WalletConnectPluginParams) {
    const core = new Core({ projectId });
    this.client = Web3Wallet.init({
      core,
      metadata,
    });

    this.init();
  }

  async init() {
    const client = await this.client;
    console.log('WC client is init');
    client.on('session_proposal', this.onSessionProposal.bind(this));
    client.on('session_request', this.onSessionRequest.bind(this));
    client.on('session_delete', this.onSessionDelete.bind(this));

    // TODO: this event to listen proposal expire
    client.on('proposal_expire', (e) => console.log(e.id, 'proposal_expire'));
  }

  /**
   * when session create or delete
   * @returns
   */
  getWCSessionChangeSubscribe() {
    return this.sessionStateChangeSubject;
  }

  emitWCSessionChange() {
    this.sessionStateChangeSubject.next();
  }

  getWCProposalSubscribe() {
    return this.sessionProposalSubject;
  }
  emitWCProposal(args: WCProposalEventType) {
    this.sessionProposalSubject.next(args);
  }
  async onSessionProposal(proposal: Web3WalletTypes.SessionProposal) {
    const client = await this.client;
    // TODO Check the connect
    // const { verified } = proposal.verifyContext;

    this.emitWCLoading(false);

    const { proposer, requiredNamespaces, optionalNamespaces } = proposal.params;

    // TODO  check requiredNamespaces is supported

    const { metadata } = proposer;

    const approveSession: WCProposalEventType['approve'] = async (args) => {
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces: {
          eip155: {
            ...args,
            events: [...(requiredNamespaces?.eip155?.events || SUPPORT_SESSION_EVENTS)],
            methods: [...SUPPORT_SIGN_METHODS, ...SUPPORTED_TRANSACTION_METHODS],
          },
        },
      });

      await client.approveSession({
        id: proposal.id,
        namespaces: approvedNamespaces,
      });
      this.emitWCSessionChange();
    };
    const rejectSession: WCProposalEventType['reject'] = async (reason) => {
      await client.rejectSession({ id: proposal.params.id, reason: getSdkError(reason || 'USER_REJECTED') });
    };

    this.emitWCProposal({
      requiredNamespaces,
      optionalNamespaces,
      metadata,
      approve: approveSession,
      reject: rejectSession,
    });
  }

  onSessionRequest(request: Web3WalletTypes.SessionRequest) {}

  onSessionDelete(event: Web3WalletTypes.SessionDelete) {
    this.emitWCSessionChange();
  }

  async getAllSession() {
    const client = await this.client;
    return client.getActiveSessions();
  }

  async disconnectSession({ topic }: { topic: string }) {
    const client = await this.client;

    await client.disconnectSession({ topic, reason: getSdkError('USER_DISCONNECTED') });
    this.emitWCSessionChange();
  }

  removeAllSession() {}

  getWCLoadingSubscribe() {
    return this.loadingSubject;
  }

  emitWCLoading(loading: boolean) {
    this.loadingSubject.next(loading);
  }

  async connect({ wcURI }: { wcURI: string }) {
    const { version, topic } = parseUri(wcURI);

    if (version === 1) {
      throw new WalletConnectPluginError('VersionNotSupported');
    }

    try {
      const client = await this.client;
      await client.pair({ uri: wcURI });
    } catch (error: any) {
      this.emitWCLoading(false);
      throw new WalletConnectPluginError(error?.message || 'UnknownError');
    }
  }
}
