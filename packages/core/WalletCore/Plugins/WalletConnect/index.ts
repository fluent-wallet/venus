import { Plugin } from '@core/WalletCore/Plugins';
import { Core } from '@walletconnect/core';
import Client, { Web3Wallet, Web3WalletTypes } from '@walletconnect/web3wallet';
import { parseUri, getSdkError, buildApprovedNamespaces, type BuildApprovedNamespacesParams } from '@walletconnect/utils';
import { Subject, filter } from 'rxjs';
import { uniq } from 'lodash-es';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    WalletConnect: WalletConnect;
  }
}

const notNull = <T>(value: T | null): value is T => value !== null;

export interface WalletConnectPluginParams {
  projectId: string;
  metadata: Web3WalletTypes.Options['metadata'];
}

export interface WCProposalEventType {
  metadata: Web3WalletTypes.Metadata;
  approve: (args: BuildApprovedNamespacesParams['supportedNamespaces']) => Promise<void>;
  reject: () => Promise<void>;
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
  }
  getSubscribeWCProposal() {
    return this.sessionProposalSubject;
  }
  addToSubscribeWCProposal(args: WCProposalEventType) {
    this.sessionProposalSubject.next(args);
  }
  async onSessionProposal(proposal: Web3WalletTypes.SessionProposal) {
    const client = await this.client;
    // TODO Check the connect
    // const { verified } = proposal.verifyContext;

    this.addToSubscribeLoading(false);

    const { proposer, requiredNamespaces, optionalNamespaces } = proposal.params;

    // TODO  check requiredNamespaces is supported


    const { metadata } = proposer;

    async function approveSession(args: BuildApprovedNamespacesParams['supportedNamespaces']) {
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces: args,
      });

      await client.approveSession({
        id: proposal.id,
        namespaces: approvedNamespaces,
      });

    }
    async function rejectSession() {
      await client.rejectSession({ id: proposal.params.id, reason: getSdkError('USER_REJECTED') });
    }

    this.addToSubscribeWCProposal({
      metadata,
      approve: approveSession,
      reject: rejectSession,
    });
  }

  onSessionRequest(request: Web3WalletTypes.SessionRequest) {}

  onSessionDelete(event: Web3WalletTypes.SessionDelete) {}

  getAllSession() {}

  removeSession() {}

  removeAllSession() {}

  subscribeLoading() {
    return this.loadingSubject;
  }

  addToSubscribeLoading(loading: boolean) {
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
      this.addToSubscribeLoading(false);
      throw new WalletConnectPluginError(error?.message || 'UnknownError');
    }
  }
}
