import { Core } from '@walletconnect/core';
import Client, { Web3Wallet, Web3WalletTypes } from '@walletconnect/web3wallet';
import { parseUri, getSdkError, buildApprovedNamespaces } from '@walletconnect/utils';
import { Subject, BehaviorSubject, tap, concatMap, of, switchMap, catchError } from 'rxjs';
import { formatJsonRpcResult, formatJsonRpcError } from '@json-rpc-tools/utils';
import { Plugin } from '@core/WalletCore/Plugins';

import { IWCSendTransactionEvent, IWCSessionProposalEvent, WalletConnectPluginEventType, WalletConnectPluginEvents, WalletConnectRPCMethod } from './types';
import methods from '@core/WalletCore/Methods';

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

export class WalletConnectPluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletConnectPluginError';
  }
}

export default class WalletConnect implements Plugin {
  public name = 'WalletConnect';

  client: Promise<Client>;
  sessionStateChangeSubject = new Subject<void>();
  private eventsSubject = new Subject<WalletConnectPluginEvents>();
  currentEventSubject = new BehaviorSubject<WalletConnectPluginEvents | null | undefined>(undefined);
  eventsQueue: WalletConnectPluginEvents[] = [];

  constructor({ projectId, metadata }: WalletConnectPluginParams) {
    this.eventsSubject
      .pipe(
        // tap((evt) => {
        //   console.log('tap: ', evt);
        // }),
        tap((event) => this.eventsQueue.push(event)),
        concatMap((event) =>
          of(event).pipe(
            switchMap(
              (event) =>
                new Promise<void>((_resolve) => {
                  this.currentEventSubject.next({
                    type: event.type,
                    data: event.data,
                    action: {
                      approve: async (...params: any) => {
                        try {
                          await event.action.approve(...params);
                          _resolve();
                        } catch (_) {
                          _resolve();
                        } finally {
                          this.currentEventSubject.next(null);
                        }
                      },
                      reject: async (...reason: any) => {
                        try {
                          await event.action.reject(...reason);
                          _resolve();
                        } catch (_) {
                          _resolve();
                        } finally {
                          this.currentEventSubject.next(null);
                        }
                      },
                    },
                  } as any);
                }),
            ),
            tap(() => {
              this.eventsQueue.shift();
            }),
          ),
        ),
      )
      .subscribe();

    const core = new Core({ projectId });
    this.client = Web3Wallet.init({
      core,
      metadata,
    });

    this.init();
  }

  activeSessionMetadata: Record<string, Web3WalletTypes.Metadata> = {};

  async init() {
    const client = await this.client;
    client.on('session_proposal', this.onSessionProposal.bind(this));
    client.on('session_request', this.onSessionRequest.bind(this));
    client.on('session_delete', this.onSessionDelete.bind(this));

    // TODO: this event to listen proposal expire
    client.on('proposal_expire', (e) => console.log(e.id, 'proposal_expire'));

    const sessions = client.getActiveSessions();
    Object.keys(sessions).forEach((key) => {
      this.activeSessionMetadata[key] = sessions[key].peer.metadata;
    });
  }

  /**
   * when session create or delete
   * @returns
   */
  getWCSessionChangeSubscribe() {
    return this.sessionStateChangeSubject;
  }

  emitSessionChange() {
    this.sessionStateChangeSubject.next();
  }

  async onSessionProposal(proposal: Web3WalletTypes.SessionProposal) {
    const client = await this.client;
    // TODO: Check the connect
    // const { verified } = proposal.verifyContext;
    const { proposer, requiredNamespaces, optionalNamespaces } = proposal.params;

    // TODO: check requiredNamespaces is supported
    const { metadata } = proposer;

    const verifiedData = proposal.verifyContext.verified;

    if (verifiedData.isScam) {
      return client.rejectSession({ id: proposal.params.id, reason: { code: -1, message: 'SCAM CONNECT' } });
    }

    let dapp = await methods.isAppExist(verifiedData.origin || metadata.url);
    if (!dapp) {
      dapp = await methods.createApp({
        identity: metadata.url,
        origin: metadata.url,
        name: metadata.name,
        icon: metadata?.icons[0],
      });
    }

    const approveSession: IWCSessionProposalEvent['action']['approve'] = async (args) => {
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

      const activeSession = await client.approveSession({
        id: proposal.id,
        namespaces: approvedNamespaces,
      });
      this.emitSessionChange();
      // save metadata
      this.activeSessionMetadata[activeSession.topic] = activeSession.peer.metadata;
    };

    const rejectSession: IWCSessionProposalEvent['action']['reject'] = async (reason) =>
      await client.rejectSession({ id: proposal.params.id, reason: getSdkError(reason || 'USER_REJECTED') });

    this.eventsSubject.next({
      type: WalletConnectPluginEventType.SESSION_PROPOSAL,
      data: {
        requiredNamespaces,
        optionalNamespaces,
        metadata,
      },
      action: {
        approve: approveSession,
        reject: rejectSession,
      },
    });
  }

  async onSessionRequest(request: Web3WalletTypes.SessionRequest) {
    const client = await this.client;

    const { id, topic } = request;
    const { chainId } = request.params;
    const { method, params } = request.params.request;

    const isSupportSignMethods = SUPPORT_SIGN_METHODS.includes(method as WalletConnectRPCMethod);
    const isSupportTransactionMethods = SUPPORTED_TRANSACTION_METHODS.includes(method as WalletConnectRPCMethod);
    if (!isSupportSignMethods && !isSupportTransactionMethods) {
      await client.respondSessionRequest({
        topic,
        response: formatJsonRpcError(id, `${method} is not supported`),
      });
      return;
    }

    if (isSupportSignMethods) {
      let message = '';
      let address = '';
      if (method === WalletConnectRPCMethod.PersonalSign) {
        message = params[0];
        address = params[1];
      } else if (method.startsWith(WalletConnectRPCMethod.SignTypedData)) {
        address = params[0];
        message = params[1];
      }

      const approve: IWCSendTransactionEvent['action']['approve'] = async (signedMessage) => {
        await client.respondSessionRequest({
          topic,
          response: formatJsonRpcResult(id, signedMessage),
        });
      };

      const reject: IWCSendTransactionEvent['action']['reject'] = async (reason) =>
        await client.respondSessionRequest({
          topic,
          response: formatJsonRpcError(id, reason || 'USER_REJECTED'),
        });

      this.eventsSubject.next({
        type: WalletConnectPluginEventType.SIGN_MESSAGE,
        data: {
          chainId,
          address,
          message,
          metadata: this.activeSessionMetadata[topic],
          method: method as WalletConnectRPCMethod,
        },
        action: {
          approve,
          reject,
        },
      });
    } else if (isSupportTransactionMethods) {
      const txFromParams = params[0] || {};

      const transaction: IWCSendTransactionEvent['data']['tx'] = {
        ...txFromParams,
        nonce: txFromParams.nonce ? Number(txFromParams.nonce) : undefined,
      };

      const approve: IWCSendTransactionEvent['action']['approve'] = async (txHash) => {
        await client.respondSessionRequest({
          topic,
          response: formatJsonRpcResult(id, txHash),
        });
      };

      const reject: IWCSendTransactionEvent['action']['reject'] = async (reason) =>
        await client.respondSessionRequest({
          topic,
          response: formatJsonRpcError(id, reason || 'USER_REJECTED'),
        });

      const address = transaction?.from;

      if (!address) reject('from is required');

      this.eventsSubject.next({
        type: WalletConnectPluginEventType.SEND_TRANSACTION,
        data: {
          chainId,
          address: address,
          metadata: this.activeSessionMetadata[topic],
          method: method as WalletConnectRPCMethod,
          tx: transaction,
        },
        action: {
          approve,
          reject,
        },
      });
    }
  }

  onSessionDelete(event: Web3WalletTypes.SessionDelete) {
    this.emitSessionChange();
  }

  async getAllSession() {
    const client = await this.client;
    return client.getActiveSessions();
  }

  async disconnectSession({ topic }: { topic: string }) {
    const client = await this.client;

    await client.disconnectSession({ topic, reason: getSdkError('USER_DISCONNECTED') });
    this.emitSessionChange();
  }

  removeAllSession() {
    //
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
      throw new WalletConnectPluginError(error?.message || 'UnknownError');
    }
  }
}
