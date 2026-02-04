import {
  CoreError,
  EXTREQ_REQUEST_CANCELED,
  EXTREQ_REQUEST_TIMEOUT,
  TX_INVALID_PARAMS,
  TX_SIGN_ADDRESS_MISMATCH,
  WC_APPROVE_SESSION_FAILED,
  WC_DISCONNECT_FAILED,
  WC_PAIR_FAILED,
  WC_PAIR_URI_VERSION_NOT_SUPPORTED,
  WC_PAIRING_ALREADY_EXISTS,
  WC_REJECT_SESSION_FAILED,
  WC_UNSUPPORTED_CHAINS,
  WC_UNSUPPORTED_NAMESPACE,
  WC_UNSUPPORTED_NETWORK,
} from '@core/errors';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import type { Logger } from '@core/runtime/types';
import {
  type AccountService,
  type NetworkService,
  parseEvmRpcTransactionRequest,
  parseSignMessageParameters,
  parseSignTypedDataParameters,
  type TransactionService,
} from '@core/services';
import type { SigningService } from '@core/services/signing';
import { NetworkType } from '@core/types';
import type Client from '@reown/walletkit';
import type { WalletKitTypes } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError, parseUri } from '@walletconnect/utils';
import type { ExternalRequestSnapshot, ExternalRequestsService, JsonValue } from '../externalRequests';

// White-list for session_request methods.
const SUPPORTED_SESSION_REQUEST_METHODS = ['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction'] as const;
type SupportedSessionRequestMethod = (typeof SUPPORTED_SESSION_REQUEST_METHODS)[number];

const isSupportedSessionRequestMethod = (value: unknown): value is SupportedSessionRequestMethod => {
  if (typeof value !== 'string') return false;
  return (SUPPORTED_SESSION_REQUEST_METHODS as readonly string[]).includes(value);
};

export type WalletConnectSessionSnapshot = {
  topic: string;
  peer: {
    metadata: {
      name: string;
      url: string;
      icons?: string[];
    };
  };
  namespaces: {
    eip155?: {
      accounts: string[];
      chains?: string[];
      methods?: string[];
      events?: string[];
    };
  };
};

export type WalletConnectServiceOptions = {
  eventBus: EventBus<CoreEventMap>;
  logger: Logger;
  clientFactory: () => Promise<Client>;
  closeTransportOnStop: boolean;

  externalRequests?: ExternalRequestsService;
  accountService?: AccountService;
  networkService?: NetworkService;
  signingService?: SigningService;
  transactionService?: TransactionService;
};
export class WalletConnectService {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly logger: Logger;
  private readonly clientFactory: () => Promise<Client>;
  private readonly closeTransportOnStop: boolean;

  private readonly externalRequests?: ExternalRequestsService;
  private readonly accountService?: AccountService;
  private readonly networkService?: NetworkService;
  private readonly signingService?: SigningService;
  private readonly transactionService?: TransactionService;

  private client: Client | null = null;
  private sessions: WalletConnectSessionSnapshot[] = [];
  private started = false;
  private startInFlight: Promise<void> | null = null;

  constructor(options: WalletConnectServiceOptions) {
    this.eventBus = options.eventBus;
    this.logger = options.logger;
    this.clientFactory = options.clientFactory;
    this.closeTransportOnStop = options.closeTransportOnStop;

    this.externalRequests = options.externalRequests;
    this.accountService = options.accountService;
    this.networkService = options.networkService;
    this.signingService = options.signingService;
    this.transactionService = options.transactionService;
  }

  private readonly onSessionDelete = (event: WalletKitTypes.SessionDelete) => {
    void this.handleSessionDelete(event);
  };

  private readonly onSessionProposal = (proposal: WalletKitTypes.SessionProposal) => {
    void this.handleSessionProposal(proposal);
  };

  private readonly onSessionRequest = (request: WalletKitTypes.SessionRequest) => {
    void this.handleSessionRequest(request);
  };

  public async start(): Promise<void> {
    if (this.started) return;
    if (this.startInFlight) return this.startInFlight;

    const run = (async () => {
      let client: Client | null = null;

      try {
        client = await this.clientFactory();
        this.client = client;

        client.on('session_proposal', this.onSessionProposal);
        client.on('session_delete', this.onSessionDelete);
        client.on('session_request', this.onSessionRequest);

        await this.refreshSessions();

        this.eventBus.emit('wallet-connect/sessions-changed', { reason: 'init' });
        this.started = true;
      } catch (error) {
        try {
          if (client) {
            try {
              client.off('session_proposal', this.onSessionProposal);
              client.off('session_delete', this.onSessionDelete);
              client.off('session_request', this.onSessionRequest);
            } catch (offError) {
              this.logger.warn('WalletConnectService:start:cleanup-off-failed', { error: offError });
            }

            if (this.closeTransportOnStop) {
              try {
                const relayer = client.core?.relayer;
                if (relayer?.transportClose) {
                  await relayer.transportClose();
                }
              } catch (closeError) {
                this.logger.warn('WalletConnectService:start:cleanup-transport-close-failed', { error: closeError });
              }
            }
          }
        } finally {
          if (this.client === client) this.client = null;
          this.sessions = [];
          this.started = false;
        }

        throw error;
      }
    })();

    this.startInFlight = run;

    try {
      await run;
    } finally {
      if (this.startInFlight === run) this.startInFlight = null;
    }
  }

  public async stop(): Promise<void> {
    const inFlight = this.startInFlight;
    if (inFlight) {
      try {
        await inFlight;
      } catch {
        // start() may have failed; continue cleanup to ensure stopped state.
      }
    }

    if (!this.client) {
      this.started = false;
      this.sessions = [];
      return;
    }

    const client = this.client;
    this.client = null;
    this.started = false;

    try {
      client.off('session_proposal', this.onSessionProposal);
      client.off('session_delete', this.onSessionDelete);
      client.off('session_request', this.onSessionRequest);
    } catch (error) {
      this.logger.warn('WalletConnectService:stop:off-failed', { error });
    }

    this.sessions = [];

    if (!this.closeTransportOnStop) return;

    try {
      const relayer = client.core?.relayer;
      if (relayer?.transportClose) {
        await relayer.transportClose();
      }
    } catch (error) {
      this.logger.warn('WalletConnectService:stop:transport-close-failed', { error });
    }
  }

  public getSessions(): WalletConnectSessionSnapshot[] {
    return this.sessions.slice();
  }

  public async pair(uri: string): Promise<void> {
    if (typeof uri !== 'string' || !uri.startsWith('wc:')) {
      throw new CoreError({ code: WC_PAIR_FAILED, message: 'WalletConnect URI must start with wc:.' });
    }

    await this.start();

    const client = this.client;
    if (!client) {
      throw new CoreError({ code: WC_PAIR_FAILED, message: 'WalletConnect client is not available.' });
    }

    try {
      const { version } = parseUri(uri);
      if (version === 1) {
        throw new CoreError({ code: WC_PAIR_URI_VERSION_NOT_SUPPORTED, message: 'WalletConnect v1 is not supported.' });
      }

      await client.pair({ uri, activatePairing: true });
    } catch (error) {
      if (error instanceof CoreError) throw error;

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Pairing already exists')) {
        throw new CoreError({ code: WC_PAIRING_ALREADY_EXISTS, message: 'WalletConnect pairing already exists.', cause: error });
      }

      throw new CoreError({ code: WC_PAIR_FAILED, message: 'WalletConnect pair failed.', cause: error });
    }
  }

  public async disconnect(topic: string): Promise<void> {
    if (typeof topic !== 'string' || topic.length === 0) {
      throw new CoreError({ code: WC_DISCONNECT_FAILED, message: 'WalletConnect topic is required.' });
    }
    await this.start();

    const client = this.client;
    if (!client) {
      throw new CoreError({ code: WC_DISCONNECT_FAILED, message: 'WalletConnect client is not available.' });
    }

    try {
      await client.disconnectSession({ topic, reason: getSdkError('USER_DISCONNECTED') });

      if (!this.started || this.client !== client) {
        return;
      }

      await this.refreshSessions();
      this.eventBus.emit('wallet-connect/sessions-changed', { reason: 'disconnect', topic });
    } catch (error) {
      throw new CoreError({ code: WC_DISCONNECT_FAILED, message: 'WalletConnect disconnect failed.', cause: error });
    }
  }

  private async handleSessionDelete(event: WalletKitTypes.SessionDelete): Promise<void> {
    if (!this.started) return;

    await this.refreshSessions();

    this.eventBus.emit('wallet-connect/sessions-changed', {
      reason: 'session_delete',
      topic: event.topic,
    });
  }

  private async refreshSessions(): Promise<void> {
    if (!this.client) {
      this.sessions = [];
      return;
    }

    const active = this.client.getActiveSessions();
    const snapshots = Object.values(active).map<WalletConnectSessionSnapshot>((session) => {
      const peerMeta = session.peer?.metadata;
      const metadata = {
        name: typeof peerMeta?.name === 'string' ? peerMeta.name : '',
        url: typeof peerMeta?.url === 'string' ? peerMeta.url : '',
        icons: Array.isArray(peerMeta?.icons) ? peerMeta.icons.filter((x): x is string => typeof x === 'string') : undefined,
      };

      const eip155 = (session.namespaces as unknown as { eip155?: Record<string, unknown> })?.eip155;
      const pickStringArray = (value: unknown): string[] | undefined => {
        if (!Array.isArray(value)) return undefined;
        const list = value.filter((x): x is string => typeof x === 'string');
        return list.length > 0 ? list : undefined;
      };

      return {
        topic: session.topic,
        peer: { metadata },
        namespaces: eip155
          ? {
              eip155: {
                accounts: pickStringArray((eip155 as Record<string, unknown>).accounts) ?? [],
                chains: pickStringArray((eip155 as Record<string, unknown>).chains),
                methods: pickStringArray((eip155 as Record<string, unknown>).methods),
                events: pickStringArray((eip155 as Record<string, unknown>).events),
              },
            }
          : {},
      };
    });

    snapshots.sort((a, b) => a.topic.localeCompare(b.topic));
    this.sessions = snapshots;
  }

  private async handleSessionProposal(proposal: WalletKitTypes.SessionProposal): Promise<void> {
    const client = this.client;

    if (!this.started || !client) return;

    const proposalNumericId = typeof proposal?.params?.id === 'number' ? proposal.params.id : proposal?.id;
    const proposalId = `p_${String(proposalNumericId)}`;

    const { metadata, origin, requiredEip155Chains, requiredMethods, requiredEvents } = this.extractProposalInfo(proposal);

    if (requiredEip155Chains.length === 0) {
      const error = new CoreError({ code: WC_UNSUPPORTED_NAMESPACE, message: 'WalletConnect supports EVM (eip155) only.' });
      this.logger.warn('WalletConnectService:proposal-rejected', { error });

      await this.safeRejectSession(client, proposalNumericId, getSdkError('UNSUPPORTED_NAMESPACE_KEY'));
      return;
    }

    const supportedChains = await this.getSupportedRequiredChains(requiredEip155Chains);

    if (supportedChains.unsupported.length > 0) {
      const error = new CoreError({
        code: WC_UNSUPPORTED_CHAINS,
        message: 'Unsupported required chains.',
        context: { required: requiredEip155Chains, unsupported: supportedChains.unsupported },
      });
      this.logger.warn('WalletConnectService:proposal-rejected', { error });

      await this.safeRejectSession(client, proposalNumericId, getSdkError('UNSUPPORTED_CHAINS'));
      return;
    }
    const snapshot: ExternalRequestSnapshot = {
      provider: 'wallet-connect',
      kind: 'session_proposal',
      proposalId,
      origin,
      metadata,
      requiredNamespaces: this.toJsonValue(proposal.params?.requiredNamespaces),
      optionalNamespaces: this.toJsonValue(proposal.params?.optionalNamespaces),
    };

    if (!this.externalRequests) {
      const error = new CoreError({ code: WC_REJECT_SESSION_FAILED, message: 'ExternalRequestsService is not available.' });
      this.logger.error('WalletConnectService:proposal-rejected', { error });
      await this.safeRejectSession(client, proposalNumericId, getSdkError('USER_REJECTED'));
      return;
    }

    this.externalRequests.request({
      key: proposalId,
      request: snapshot,
      handlers: {
        onApprove: async () => {
          await this.approveSessionProposal({
            client,
            proposal,
            proposalNumericId,
            supportedChains: supportedChains.supported,
            requiredMethods,
            requiredEvents,
          });
        },
        onReject: async () => {
          await this.safeRejectSession(client, proposalNumericId, getSdkError('USER_REJECTED'));
        },
      },
    });
  }
  private async approveSessionProposal(params: {
    client: Client;
    proposal: WalletKitTypes.SessionProposal;
    proposalNumericId: number;
    supportedChains: string[];
    requiredMethods: string[];
    requiredEvents: string[];
  }): Promise<void> {
    try {
      if (!this.networkService || !this.accountService) {
        throw new CoreError({ code: WC_APPROVE_SESSION_FAILED, message: 'Missing NetworkService/AccountService.' });
      }

      const currentNetwork = await this.networkService.getCurrentNetwork();
      if (currentNetwork.networkType !== NetworkType.Ethereum) {
        throw new CoreError({
          code: WC_UNSUPPORTED_NETWORK,
          message: 'Current network is not EVM; user must switch to EVM network before approving.',
          context: { currentNetworkType: currentNetwork.networkType },
        });
      }

      const account = await this.accountService.getCurrentAccount();
      const address = account?.address;
      if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
        throw new CoreError({ code: WC_APPROVE_SESSION_FAILED, message: 'Missing EVM hex address.' });
      }

      const supportedNamespaces = {
        eip155: {
          chains: params.supportedChains,
          accounts: params.supportedChains.map((chain) => `${chain}:${address}`),
          methods: params.requiredMethods,
          events: params.requiredEvents,
        },
      };

      const approvedNamespaces = buildApprovedNamespaces({
        proposal: params.proposal.params,
        supportedNamespaces: supportedNamespaces,
      });

      await params.client.approveSession({
        id: params.proposalNumericId,
        namespaces: approvedNamespaces,
      });

      await this.refreshSessions();
    } catch (error) {
      const coreError =
        error instanceof CoreError ? error : new CoreError({ code: WC_APPROVE_SESSION_FAILED, message: 'approveSession failed.', cause: error });

      this.logger.warn('WalletConnectService:approve-failed', { error: coreError });
      await this.safeRejectSession(params.client, params.proposalNumericId, getSdkError('USER_REJECTED'));
    }
  }

  private async handleSessionRequest(request: WalletKitTypes.SessionRequest): Promise<void> {
    const client = this.client;
    if (!this.started || !client) return;

    const topic = request.topic;
    const id = request.id;

    const chainId = request.params?.chainId;
    const rpc = request.params?.request;
    const method = rpc?.method;
    const rpcParams = rpc?.params;

    if (typeof chainId !== 'string' || !chainId.startsWith('eip155:')) {
      await this.safeRespondSessionRequestError({ client, topic, id, code: 4902, message: 'Unrecognized chain ID.' });
      return;
    }
    if (!isSupportedSessionRequestMethod(method)) {
      await this.safeRespondSessionRequestError({ client, topic, id, code: 4200, message: 'Unsupported method.' });
      return;
    }

    if (!this.externalRequests) {
      await this.safeRespondSessionRequestError({ client, topic, id, code: -32603, message: 'Internal error.' });
      return;
    }

    const origin = this.resolveRequestOrigin(topic, request);

    const snapshot: ExternalRequestSnapshot = {
      provider: 'wallet-connect',
      kind: 'session_request',
      sessionId: topic,
      origin,
      chainId,
      method,
      params: this.toJsonValue(rpcParams),
    };

    this.externalRequests.request({
      key: topic,
      request: snapshot,
      handlers: {
        onApprove: async () => {
          await this.approveSessionRequest({ client, topic, id, chainId, method, rpcParams });
        },
        onReject: async (error) => {
          const rpcError = this.mapRejectError(error);
          await this.safeRespondSessionRequestError({ client, topic, id, ...rpcError });
        },
      },
    });
  }

  private async approveSessionRequest(params: {
    client: Client;
    topic: string;
    id: number;
    chainId: string;
    method: SupportedSessionRequestMethod;
    rpcParams: unknown;
  }) {
    if (!this.started || this.client !== params.client) return;

    if (!this.networkService || !this.accountService) {
      await this.safeRespondSessionRequestError({ client: params.client, topic: params.topic, id: params.id, code: -32603, message: 'Internal error.' });
      return;
    }

    const currentNetwork = await this.networkService.getCurrentNetwork();
    const expectedChainId = `eip155:${currentNetwork.netId}`;

    if (currentNetwork.networkType !== NetworkType.Ethereum || expectedChainId !== params.chainId) {
      await this.safeRespondSessionRequestError({ client: params.client, topic: params.topic, id: params.id, code: 4902, message: 'Unrecognized chain ID.' });
      return;
    }

    const account = await this.accountService.getCurrentAccount();
    const accountId = account?.id;
    const addressId = account?.currentAddressId;

    if (!accountId || !addressId) {
      await this.safeRespondSessionRequestError({ client: params.client, topic: params.topic, id: params.id, code: 4100, message: 'Unauthorized.' });
      return;
    }

    try {
      if (params.method === 'personal_sign') {
        if (!this.signingService) throw new CoreError({ code: TX_INVALID_PARAMS, message: 'Missing SigningService.' });
        const request = parseSignMessageParameters(params.rpcParams);
        const signature = await this.signingService.signPersonalMessage({ accountId, addressId, request });
        await this.safeRespondSessionRequestResult({ client: params.client, topic: params.topic, id: params.id, result: signature });
        return;
      }

      if (params.method === 'eth_signTypedData_v4') {
        if (!this.signingService) throw new CoreError({ code: TX_INVALID_PARAMS, message: 'Missing SigningService.' });
        const request = parseSignTypedDataParameters(params.rpcParams);
        const signature = await this.signingService.signTypedDataV4({ accountId, addressId, request });
        await this.safeRespondSessionRequestResult({ client: params.client, topic: params.topic, id: params.id, result: signature });
        return;
      }

      // eth_sendTransaction
      if (!this.transactionService) {
        await this.safeRespondSessionRequestError({ client: params.client, topic: params.topic, id: params.id, code: -32603, message: 'Internal error.' });
        return;
      }

      const request = parseEvmRpcTransactionRequest(params.rpcParams);
      const tx = await this.transactionService.sendDappTransaction({ addressId, request });
      await this.safeRespondSessionRequestResult({ client: params.client, topic: params.topic, id: params.id, result: tx.hash });
    } catch (error) {
      const rpcError = this.mapApproveError(error);
      this.logger.warn('WalletConnectService:session-request:approve-failed', { error });
      await this.safeRespondSessionRequestError({ client: params.client, topic: params.topic, id: params.id, ...rpcError });
    }
  }

  private mapRejectError(error: unknown): { code: number; message: string } {
    if (error instanceof CoreError) {
      if (error.code === EXTREQ_REQUEST_TIMEOUT) return { code: 4001, message: 'Request expired.' };

      if (error.code === EXTREQ_REQUEST_CANCELED) {
        const reason = error.context?.reason;
        if (reason === 'stopped') return { code: 4001, message: 'Request canceled.' };
        return { code: 4001, message: 'User rejected the request.' };
      }
    }

    return { code: 4001, message: 'User rejected the request.' };
  }

  private mapApproveError(error: unknown): { code: number; message: string } {
    if (error instanceof CoreError) {
      if (error.code === TX_INVALID_PARAMS) return { code: -32602, message: 'Invalid params.' };
      if (error.code === TX_SIGN_ADDRESS_MISMATCH) return { code: 4100, message: 'Unauthorized.' };
    }
    return { code: -32603, message: 'Internal error.' };
  }

  private resolveRequestOrigin(topic: string, request: WalletKitTypes.SessionRequest): string {
    const verifiedOrigin = request.verifyContext?.verified?.origin;
    if (typeof verifiedOrigin === 'string') return verifiedOrigin;

    const active = this.client?.getActiveSessions?.();
    const peerUrl = active && typeof active === 'object' ? active[topic]?.peer?.metadata?.url : undefined;
    if (typeof peerUrl === 'string') return peerUrl;

    const cached = this.sessions.find((s) => s.topic === topic)?.peer?.metadata?.url;
    return typeof cached === 'string' ? cached : '';
  }
  private async safeRespondSessionRequestResult(params: { client: Client; topic: string; id: number; result: unknown }): Promise<void> {
    if (!this.started || this.client !== params.client) return;

    try {
      await params.client.respondSessionRequest({
        topic: params.topic,
        response: { id: params.id, jsonrpc: '2.0', result: params.result },
      });
    } catch (error) {
      this.logger.warn('WalletConnectService:respondSessionRequest:result-failed', { error });
    }
  }

  private async safeRespondSessionRequestError(params: { client: Client; topic: string; id: number; code: number; message: string }): Promise<void> {
    if (!this.started || this.client !== params.client) return;

    try {
      await params.client.respondSessionRequest({
        topic: params.topic,
        response: { id: params.id, jsonrpc: '2.0', error: { code: params.code, message: params.message } },
      });
    } catch (error) {
      this.logger.warn('WalletConnectService:respondSessionRequest:error-failed', { error });
    }
  }

  private async safeRejectSession(client: Client, proposalNumericId: number, reason: { code: number; message: string }): Promise<void> {
    try {
      await client.rejectSession({ id: proposalNumericId, reason });
    } catch (error) {
      const coreError = new CoreError({ code: WC_REJECT_SESSION_FAILED, message: 'rejectSession failed.', cause: error });
      this.logger.warn('WalletConnectService:reject-failed', { error: coreError });
    }
  }
  private extractProposalInfo(proposal: WalletKitTypes.SessionProposal): {
    metadata: { name: string; url: string; icons?: string[] };
    origin: string;
    requiredEip155Chains: string[];
    requiredMethods: string[];
    requiredEvents: string[];
  } {
    const proposer = proposal.params?.proposer;
    const meta = proposer?.metadata ?? {};
    const icons = Array.isArray(meta.icons) ? meta.icons.filter((x: unknown): x is string => typeof x === 'string') : undefined;

    const origin =
      typeof proposal.verifyContext?.verified?.origin === 'string' ? proposal.verifyContext.verified.origin : typeof meta.url === 'string' ? meta.url : '';

    const required = proposal.params?.requiredNamespaces ?? {};
    const requiredKeys = Object.keys(required);

    const requiredEip155ChainsSet = new Set<string>();
    const requiredMethodsSet = new Set<string>();
    const requiredEventsSet = new Set<string>();

    for (const key of requiredKeys) {
      if (!key.startsWith('eip155')) continue;

      if (key.includes(':')) {
        requiredEip155ChainsSet.add(key);
        const ns = required[key] ?? {};
        if (Array.isArray(ns.methods))
          ns.methods.forEach((m: unknown) => {
            typeof m === 'string' && requiredMethodsSet.add(m);
          });
        if (Array.isArray(ns.events))
          ns.events.forEach((e: unknown) => {
            typeof e === 'string' && requiredEventsSet.add(e);
          });
        continue;
      }

      const ns = required[key] ?? {};
      if (Array.isArray(ns.chains))
        ns.chains.forEach((c: unknown) => {
          typeof c === 'string' && requiredEip155ChainsSet.add(c);
        });
      if (Array.isArray(ns.methods))
        ns.methods.forEach((m: unknown) => {
          typeof m === 'string' && requiredMethodsSet.add(m);
        });
      if (Array.isArray(ns.events))
        ns.events.forEach((e: unknown) => {
          typeof e === 'string' && requiredEventsSet.add(e);
        });
    }

    return {
      metadata: {
        name: typeof meta.name === 'string' ? meta.name : '',
        url: typeof meta.url === 'string' ? meta.url : '',
        icons,
      },
      origin,
      requiredEip155Chains: Array.from(requiredEip155ChainsSet).filter((c) => c.startsWith('eip155:')),
      requiredMethods: Array.from(requiredMethodsSet),
      requiredEvents: Array.from(requiredEventsSet),
    };
  }

  private async getSupportedRequiredChains(requiredEip155Chains: string[]): Promise<{ supported: string[]; unsupported: string[] }> {
    if (!this.networkService) {
      return { supported: [], unsupported: requiredEip155Chains };
    }

    const networks = await this.networkService.getAllNetworks();
    const supported = new Set(networks.filter((n) => n.networkType === NetworkType.Ethereum).map((n) => `eip155:${n.netId}`));

    const ok: string[] = [];
    const bad: string[] = [];

    for (const chain of requiredEip155Chains) {
      if (supported.has(chain)) ok.push(chain);
      else bad.push(chain);
    }

    return { supported: ok, unsupported: bad };
  }

  private toJsonValue(value: unknown): JsonValue {
    try {
      return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
    } catch {
      return null;
    }
  }
}
