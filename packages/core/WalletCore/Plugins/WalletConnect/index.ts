import { NetworkType, getCurrentAddress, getCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import type { Plugin } from '@core/WalletCore/Plugins';
import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils';
import { Core } from '@walletconnect/core';
import { queryNetworks } from '@core/database/models/Network/query';
import { buildApprovedNamespaces, getSdkError, parseUri } from '@walletconnect/utils';
import type Client from '@reown/walletkit';
import { WalletKit, type WalletKitTypes } from '@reown/walletkit';
import { BehaviorSubject, Subject, concatMap, of, switchMap, tap } from 'rxjs';
import { uniq } from 'lodash-es';
import { convertHexToBase32 } from '@core/utils/address';
import methods from '@core/WalletCore/Methods';
import {
  type IWCSendTransactionEvent,
  type IWCSessionProposalEvent,
  WalletConnectPluginEventType,
  type WalletConnectPluginEvents,
  WalletConnectRPCMethod,
} from './types';
import {
  ChainPrefix,
  ExtractCip155Namespace,
  mergeCIPNamespaceToEIP,
  isCIPData,
  convertEipDataToCip,
  convertEipMethodToCip,
  type Namespace,
} from '@cfx-kit/react-utils/dist/WalletConnectorHelper';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    WalletConnect: WalletConnect;
  }
}

export const SUPPORT_SESSION_EVENTS = ['chainChanged', 'accountsChanged'] as const;

export const SUPPORT_SIGN_METHODS = [
  WalletConnectRPCMethod.PersonalSign,
  WalletConnectRPCMethod.SignTypedData,
  WalletConnectRPCMethod.SignTypedDataV1,
  WalletConnectRPCMethod.SignTypedDataV3,
  WalletConnectRPCMethod.SignTypedDataV4,
  WalletConnectRPCMethod.ConfluxSignTypedData,
];

export const SUPPORTED_TRANSACTION_METHODS = [WalletConnectRPCMethod.SendTransaction, WalletConnectRPCMethod.ConfluxSendTransaction];

export const CIPPlaceHolder = '201029';

export interface WalletConnectPluginParams {
  projectId: string;
  metadata: WalletKitTypes.Options['metadata'];
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
    this.client = WalletKit.init({
      core,
      metadata,
    });

    this.init();
  }

  activeSessionMetadata: Record<string, WalletKitTypes.Metadata> = {};

  async init() {
    const client = await this.client;
    client.on('session_proposal', this.onSessionProposal.bind(this));
    client.on('session_request', this.onSessionRequest.bind(this));
    client.on('session_delete', this.onSessionDelete.bind(this));

    // TODO: this event to listen proposal expire
    client.on('proposal_expire', (e) => {
      console.log(e.id, 'proposal_expire');
    });

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

  async onSessionProposal(proposal: WalletKitTypes.SessionProposal) {
    const client = await this.client;
    // TODO: Check the connect
    // const { verified } = proposal.verifyContext;
    const { proposer, requiredNamespaces: _requiredNamespaces, optionalNamespaces: _optionalNamespaces } = proposal.params;
    const requiredNamespaces = ExtractCip155Namespace(_requiredNamespaces as Record<string, Namespace>);
    const optionalNamespaces = ExtractCip155Namespace(_optionalNamespaces as Record<string, Namespace>);

    const allNetworks = await queryNetworks();
    const requestedEVMChainsId = uniq([...(requiredNamespaces?.[ChainPrefix.EIP]?.chains || []), ...(optionalNamespaces?.[ChainPrefix.EIP]?.chains || [])]).map(
      (chain) => Number.parseInt(chain.split(':')[1]),
    );
    const requestedConfluxChainsId = uniq([
      ...(requiredNamespaces?.[ChainPrefix.CIP]?.chains || []),
      ...(optionalNamespaces?.[ChainPrefix.CIP]?.chains || []),
    ]).map((chain) => Number.parseInt(chain.split(':')[1]));

    const connectedNetworks = allNetworks
      .filter((network) =>
        network.networkType === NetworkType.Ethereum ? requestedEVMChainsId.includes(network.netId) : requestedConfluxChainsId.includes(network.netId),
      )
      .map((network) => ({ icon: network.icon!, name: network.name, netId: network.netId, id: network.id, networkType: network.networkType }));
    const evmConnectedNetworks = connectedNetworks.filter((network) => network.networkType === NetworkType.Ethereum);
    const confluxConnectedNetworks = connectedNetworks.filter((network) => network.networkType === NetworkType.Conflux);

    // TODO: check requiredNamespaces is supported
    const { metadata } = proposer;

    const verifiedData = proposal.verifyContext.verified;

    if (verifiedData.isScam) {
      return client.rejectSession({ id: proposal.params.id, reason: { code: -1, message: 'SCAM CONNECT' } });
    }

    let dapp = await methods.isAppExist(verifiedData.origin || metadata.url);
    if (!dapp) {
      try {
        dapp = await methods.createApp({
          identity: metadata.url,
          origin: metadata.url,
          name: metadata.name,
          icon: metadata?.icons[0],
        });
      } catch (error: any) {
        const message = typeof error?.message === 'string' ? error.message : String(error ?? 'Unknown error');
        if (message.includes('App already exist')) {
          dapp = await methods.isAppExist(metadata.url);
        } else {
          throw error;
        }
      }
    }

    const rejectSession: IWCSessionProposalEvent['action']['reject'] = async (reason) =>
      await client.rejectSession({ id: proposal.params.id, reason: getSdkError(reason || 'USER_REJECTED') });

    const approveSession: IWCSessionProposalEvent['action']['approve'] = async () => {
      try {
        const currentAddress = await getCurrentAddress()!;
        const evmSupportedNamespaces =
          !requiredNamespaces[ChainPrefix.EIP] && !optionalNamespaces[ChainPrefix.EIP]
            ? null
            : {
                ...(requiredNamespaces[ChainPrefix.EIP] ?? optionalNamespaces[ChainPrefix.EIP]),
                chains: evmConnectedNetworks.map((network) => `${ChainPrefix.EIP}:${network.netId}`),
                accounts: evmConnectedNetworks.map((network) => `${ChainPrefix.EIP}:${network.netId}:${currentAddress.hex!}`),
              };
        const confluxSupportedNamespaces =
          !requiredNamespaces[ChainPrefix.CIP] && !optionalNamespaces[ChainPrefix.CIP]
            ? null
            : {
                ...(requiredNamespaces[ChainPrefix.CIP] ?? optionalNamespaces[ChainPrefix.CIP]),
                chains: confluxConnectedNetworks.map((network) => `${ChainPrefix.CIP}:${network.netId}`),
                accounts: confluxConnectedNetworks.map(
                  (network) => `${ChainPrefix.CIP}:${network.netId}:${convertHexToBase32(currentAddress.hex!, network.netId)}`,
                ),
              };

        const namespaces = mergeCIPNamespaceToEIP(evmSupportedNamespaces!, confluxSupportedNamespaces);

        const approvedNamespaces = buildApprovedNamespaces({
          proposal: proposal.params,
          supportedNamespaces: {
            [ChainPrefix.EIP]: namespaces as Required<Namespace>,
          },
        });

        const activeSession = await client.approveSession({
          id: proposal.id,
          namespaces: approvedNamespaces,
        });

        this.emitSessionChange();
        // save metadata
        this.activeSessionMetadata[activeSession.topic] = activeSession.peer.metadata;
      } catch (err) {
        console.log('approve error', err);
        rejectSession();
      }
    };

    if (connectedNetworks.length === 0) {
      return rejectSession('UNSUPPORTED_CHAINS');
    }

    this.eventsSubject.next({
      type: WalletConnectPluginEventType.SESSION_PROPOSAL,
      data: {
        requiredNamespaces,
        optionalNamespaces,
        metadata,
        connectedNetworks,
      },
      action: {
        approve: approveSession,
        reject: rejectSession,
      },
    });
  }

  async onSessionRequest(request: WalletKitTypes.SessionRequest) {
    const client = await this.client;
    const currentAddressValue = await getCurrentAddressValue()!;

    const { id, topic } = request;
    const { chainId: _chainId } = request.params;
    const { method: _method, params } = request.params.request;
    const isCip = isCIPData(_chainId);
    const chainId = isCip ? convertEipDataToCip(_chainId) : _chainId;
    const method = isCip ? convertEipMethodToCip(_method) : _method;
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
      } else if (method.includes('signTypedData')) {
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

      if (address.toLowerCase() !== currentAddressValue.toLowerCase()) {
        return reject('address is not match');
      }

      this.eventsSubject.next({
        type: WalletConnectPluginEventType.SIGN_MESSAGE,
        data: {
          chainId,
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
      if (address.toLowerCase() !== currentAddressValue.toLowerCase()) {
        return reject('address is not match');
      }

      this.eventsSubject.next({
        type: WalletConnectPluginEventType.SEND_TRANSACTION,
        data: {
          chainId,
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

  onSessionDelete(event: WalletKitTypes.SessionDelete) {
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

  async removeAllSession() {
    const sessions = await this.getAllSession();

    const client = await this.client;
    await Promise.all(
      Object.keys(sessions).map((k) => {
        const session = sessions[k];
        if (session.topic) {
          return client.disconnectSession({ topic: session.topic, reason: getSdkError('USER_DISCONNECTED') });
        }
      }),
    );
    this.emitSessionChange();
  }

  async removeSessionByAddress(address: string[]) {
    const sessions = await this.getAllSession();
    const client = await this.client;

    const disconnectPromises = [];
    for (const session of Object.values(sessions)) {
      if (session.namespaces) {
        for (const namespace of Object.values(session.namespaces)) {
          if (namespace.accounts.some((account) => address.includes(account.split(':')[2]))) {
            disconnectPromises.push(client.disconnectSession({ topic: session.topic, reason: getSdkError('USER_DISCONNECTED') }));
          }
        }
      }
    }
    await Promise.all(disconnectPromises);
    this.emitSessionChange();
  }

  async connect({ wcURI }: { wcURI: string }) {
    const { version } = parseUri(wcURI);

    if (version === 1) {
      throw new WalletConnectPluginError('VersionNotSupported');
    }

    const url = new URL(wcURI);
    const sessionTopic = url.searchParams.get('sessionTopic');
    const actionSessions = await this.getAllSession();
    if (sessionTopic && actionSessions[sessionTopic]) {
      return true;
    }

    try {
      const client = await this.client;
      await client.pair({ uri: wcURI, activatePairing: true });
    } catch (error: any) {
      if (String(error).includes('Pairing already exists')) {
        throw new WalletConnectPluginError('PairingAlreadyExists');
      }
      throw new WalletConnectPluginError(error?.message || 'UnknownError');
    }
  }
}
