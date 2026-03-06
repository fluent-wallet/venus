import { SignType } from '@core/database/models/Signature/type';
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
  type SignatureRecordService,
  type TransactionService,
} from '@core/services';
import type { SigningService } from '@core/services/signing';
import { NetworkType } from '@core/types';
import type Client from '@reown/walletkit';
import type { WalletKitTypes } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError, parseUri } from '@walletconnect/utils';
import { validate as isEvmAddress } from 'ox/Address';
import type { ExternalRequestSnapshot, ExternalRequestsService, JsonValue } from '../externalRequests';

// White-list for session_request methods.
const SUPPORTED_SESSION_REQUEST_METHODS = [
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
] as const;
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
      description?: string;
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

  /**
   * Optional allowlist for supported EVM chains (WalletConnect `eip155:<netId>` strings).
   * When provided, session proposals that require chains outside this list will be rejected.
   */
  allowedEip155Chains?: string[];

  externalRequests?: ExternalRequestsService;
  accountService?: AccountService;
  networkService?: NetworkService;
  signingService: SigningService;
  transactionService?: TransactionService;
  signatureRecordService?: SignatureRecordService;
};

export class WalletConnectService {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly logger: Logger;
  private readonly clientFactory: () => Promise<Client>;
  private readonly closeTransportOnStop: boolean;

  private readonly allowedEip155Chains?: string[];

  private readonly externalRequests?: ExternalRequestsService;
  private readonly accountService?: AccountService;
  private readonly networkService?: NetworkService;
  private readonly signingService: SigningService;
  private readonly transactionService?: TransactionService;
  private readonly signatureRecordService?: SignatureRecordService;

  private client: Client | null = null;
  private sessions: WalletConnectSessionSnapshot[] = [];
  private readonly seenProposalIds = new Set<number>();
  private readonly seenSessionRequestKeys = new Set<string>();
  private started = false;
  private startInFlight: Promise<void> | null = null;

  constructor(options: WalletConnectServiceOptions) {
    this.eventBus = options.eventBus;
    this.logger = options.logger;
    this.clientFactory = options.clientFactory;
    this.closeTransportOnStop = options.closeTransportOnStop;

    this.allowedEip155Chains = options.allowedEip155Chains;

    this.externalRequests = options.externalRequests;
    this.accountService = options.accountService;
    this.networkService = options.networkService;
    this.signingService = options.signingService;
    this.transactionService = options.transactionService;
    this.signatureRecordService = options.signatureRecordService;
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
    if (this.started) {
      await this.replayPending();
      return;
    }
    if (this.startInFlight) return this.startInFlight;

    const run = (async () => {
      let client: Client | null = null;

      try {
        client = await this.clientFactory();
        this.client = client;

        client.on('session_proposal', this.onSessionProposal);
        client.on('session_delete', this.onSessionDelete);
        client.on('session_request', this.onSessionRequest);

        this.started = true;
        await this.refreshSessions();
        await this.replayPending();

        this.eventBus.emit('wallet-connect/sessions-changed', { reason: 'init' });
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
          this.seenProposalIds.clear();
          this.seenSessionRequestKeys.clear();
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
      this.seenProposalIds.clear();
      this.seenSessionRequestKeys.clear();
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
    this.seenProposalIds.clear();
    this.seenSessionRequestKeys.clear();

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
        description: typeof peerMeta?.description === 'string' ? peerMeta.description : undefined,
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

  private async replayPending(): Promise<void> {
    const client = this.client;
    if (!this.started || !client) return;

    try {
      const proposals = client.getPendingSessionProposals?.() ?? {};
      const requests = client.getPendingSessionRequests?.() ?? [];

      const proposalList = Object.values(proposals);

      for (const proposal of proposalList) {
        await this.handleSessionProposal(proposal as unknown as WalletKitTypes.SessionProposal);
      }

      for (const request of requests) {
        await this.handleSessionRequest(request as unknown as WalletKitTypes.SessionRequest);
      }
    } catch (error) {
      this.logger.warn('WalletConnectService:pending:replay-failed', { error });
    }
  }

  private async handleSessionProposal(proposal: WalletKitTypes.SessionProposal): Promise<void> {
    const client = this.client;

    if (!this.started || !client) return;

    const proposalNumericId = typeof proposal?.params?.id === 'number' ? proposal.params.id : proposal?.id;
    if (typeof proposalNumericId === 'number') {
      if (this.seenProposalIds.has(proposalNumericId)) return;
      this.seenProposalIds.add(proposalNumericId);
    }
    const proposalId = `p_${String(proposalNumericId)}`;

    const { metadata, origin, requestedEip155Chains, methods, events } = this.extractProposalInfo(proposal);

    if (requestedEip155Chains.length === 0) {
      const error = new CoreError({ code: WC_UNSUPPORTED_NAMESPACE, message: 'WalletConnect supports EVM (eip155) only.' });
      this.logger.warn('WalletConnectService:proposal-rejected', { error });

      await this.safeRejectSession(client, proposalNumericId, getSdkError('UNSUPPORTED_NAMESPACE_KEY'));
      return;
    }

    const supportedChains = await this.getSupportedRequiredChains(requestedEip155Chains);

    // Only reject when we support none of the requested chains.
    if (supportedChains.supported.length === 0) {
      const error = new CoreError({
        code: WC_UNSUPPORTED_CHAINS,
        message: 'No supported requested chains.',
        context: { requested: requestedEip155Chains },
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
            requiredMethods: methods,
            requiredEvents: events,
          });
        },
        onReject: async (error) => {
          const reasonKey = typeof error === 'string' ? error : null;
          const supportedReasonKeys = new Set(['UNSUPPORTED_CHAINS', 'UNSUPPORTED_NAMESPACE_KEY', 'USER_REJECTED'] as const);
          const reason = reasonKey && supportedReasonKeys.has(reasonKey as any) ? getSdkError(reasonKey as any) : getSdkError('USER_REJECTED');
          await this.safeRejectSession(client, proposalNumericId, reason);
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
      this.eventBus.emit('wallet-connect/sessions-changed', { reason: 'approve' });
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
    const dedupeKey = `${topic}:${String(id)}`;
    if (this.seenSessionRequestKeys.has(dedupeKey)) return;
    this.seenSessionRequestKeys.add(dedupeKey);

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
    // The old WalletCore WalletConnect plugin validated these before emitting UI events.
    if (this.networkService && this.accountService) {
      let currentAddress: string | null = null;
      try {
        const currentNetwork = await this.networkService.getCurrentNetwork();
        const expectedChainId = `eip155:${currentNetwork.netId}`;

        if (currentNetwork.networkType !== NetworkType.Ethereum || expectedChainId !== chainId) {
          await this.safeRespondSessionRequestError({ client, topic, id, code: 4902, message: 'network is not match' });
          return;
        }

        const account = await this.accountService.getCurrentAccount();
        currentAddress = typeof account?.address === 'string' && account.address ? account.address : null;
      } catch (error) {
        const rpcError = this.mapApproveError(error);
        await this.safeRespondSessionRequestError({ client, topic, id, ...rpcError });
        return;
      }

      // Only enforce address mismatch checks when we can reliably extract the "from" and we know the current address.
      if (currentAddress) {
        let requestedFrom: string | null = null;
        try {
          requestedFrom =
            method === 'eth_sendTransaction'
              ? parseEvmRpcTransactionRequest(rpcParams).from
              : method === 'personal_sign'
                ? parseSignMessageParameters(rpcParams).from
                : parseSignTypedDataParameters(rpcParams).from;
        } catch {
          requestedFrom = null;
        }

        if (requestedFrom && requestedFrom.toLowerCase() !== currentAddress.toLowerCase()) {
          await this.safeRespondSessionRequestError({ client, topic, id, code: 4100, message: 'address is not match' });
          return;
        }
      }
    }

    if (!this.externalRequests) {
      await this.safeRespondSessionRequestError({ client, topic, id, code: -32603, message: 'Internal error.' });
      return;
    }

    const origin = this.resolveRequestOrigin(topic, request);
    const metadata = this.resolveRequestMetadata(topic, request);

    const snapshot: ExternalRequestSnapshot = {
      provider: 'wallet-connect',
      kind: 'session_request',
      sessionId: topic,
      origin,
      metadata,
      chainId,
      method,
      params: this.toJsonValue(rpcParams),
    };

    this.externalRequests.request({
      key: topic,
      request: snapshot,
      handlers: {
        onApprove: async (data) => {
          // UI-driven flow: UI performs signing/sending, then calls ExternalRequestsService.approve({ data: { result } }).
          // If `result` is provided, respond immediately without re-signing in core.
          const maybeResult = (data as { result?: unknown } | null)?.result;
          if (maybeResult !== undefined) {
            await this.safeRespondSessionRequestResult({ client, topic, id, result: maybeResult });
            return;
          }

          // Backward-compatible fallback: if UI approves without providing a result, core handles the request as before.
          this.logger.warn('WalletConnectService:session-request:onApprove-fallback-core-handle', {
            topic,
            id,
            chainId,
            method,
          });

          try {
            await this.approveSessionRequest({ client, topic, id, chainId, method, rpcParams });
          } catch (error) {
            const rpcError = this.mapApproveError(error);
            this.logger.warn('WalletConnectService:session-request:onApprove-failed', { error });
            await this.safeRespondSessionRequestError({ client, topic, id, ...rpcError });
          }
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
  }): Promise<void> {
    if (!this.started || this.client !== params.client) return;

    try {
      if (!this.networkService || !this.accountService) {
        this.logger.warn('WalletConnectService:session-request:missing-services', {
          hasNetworkService: Boolean(this.networkService),
          hasAccountService: Boolean(this.accountService),
        });
        await this.safeRespondSessionRequestError({
          client: params.client,
          topic: params.topic,
          id: params.id,
          code: -32603,
          message: 'Internal error.',
        });
        return;
      }

      const currentNetwork = await this.networkService.getCurrentNetwork();
      const expectedChainId = `eip155:${currentNetwork.netId}`;

      if (currentNetwork.networkType !== NetworkType.Ethereum || expectedChainId !== params.chainId) {
        this.logger.warn('WalletConnectService:session-request:chain-mismatch', {
          requestChainId: params.chainId,
          expectedChainId,
          currentNetworkType: currentNetwork.networkType,
          currentNetId: currentNetwork.netId,
          currentChainId: currentNetwork.chainId,
        });
        await this.safeRespondSessionRequestError({
          client: params.client,
          topic: params.topic,
          id: params.id,
          code: 4902,
          message: 'Unrecognized chain ID.',
        });
        return;
      }

      const account = await this.accountService.getCurrentAccount();
      const accountId = account?.id;
      const addressId = account?.currentAddressId;

      if (!accountId || !addressId) {
        this.logger.warn('WalletConnectService:session-request:unauthorized', { topic: params.topic, id: params.id, hasAccountId: Boolean(accountId) });
        await this.safeRespondSessionRequestError({ client: params.client, topic: params.topic, id: params.id, code: 4100, message: 'Unauthorized.' });
        return;
      }

      if (params.method === 'personal_sign') {
        const request = parseSignMessageParameters(params.rpcParams);
        const signature = await this.signingService.signPersonalMessage({ accountId, addressId, request });

        try {
          const message = this.extractSignatureRecordMessage(params.rpcParams);
          await this.signatureRecordService?.createRecord({ addressId, signType: SignType.STR, message });
        } catch {
          // do not block WC response
        }

        await this.safeRespondSessionRequestResult({ client: params.client, topic: params.topic, id: params.id, result: signature });
        return;
      }

      if (params.method === 'eth_signTypedData' || params.method === 'eth_signTypedData_v3' || params.method === 'eth_signTypedData_v4') {
        const request = parseSignTypedDataParameters(params.rpcParams);
        const signature = await this.signingService.signTypedDataV4({ accountId, addressId, request });

        try {
          const message = this.extractSignatureRecordMessage(params.rpcParams);
          await this.signatureRecordService?.createRecord({ addressId, signType: SignType.JSON, message });
        } catch {
          //  do not block WC response
        }

        await this.safeRespondSessionRequestResult({ client: params.client, topic: params.topic, id: params.id, result: signature });
        return;
      }

      // eth_sendTransaction
      if (!this.transactionService) {
        this.logger.warn('WalletConnectService:session-request:missing-transaction-service', { topic: params.topic, id: params.id });
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

    if (typeof error === 'string' && error.trim() !== '') {
      return { code: 4001, message: error };
    }

    if (error instanceof Error && typeof error.message === 'string' && error.message.trim() !== '') {
      return { code: 4001, message: error.message };
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

  private resolveRequestMetadata(
    topic: string,
    _request: WalletKitTypes.SessionRequest,
  ): {
    name: string;
    url: string;
    icons?: string[];
    description?: string;
  } {
    type MetadataLike = { name?: unknown; url?: unknown; icons?: unknown; description?: unknown };

    const active = this.client?.getActiveSessions?.() as unknown as Record<string, { peer?: { metadata?: MetadataLike } }> | undefined;
    const peer = active?.[topic]?.peer?.metadata;
    const cached = this.sessions.find((s) => s.topic === topic)?.peer?.metadata as unknown as MetadataLike | undefined;
    const meta: MetadataLike = peer ?? cached ?? {};

    return {
      name: typeof meta.name === 'string' ? meta.name : '',
      url: typeof meta.url === 'string' ? meta.url : '',
      icons: Array.isArray(meta.icons) ? (meta.icons as unknown[]).filter((x): x is string => typeof x === 'string') : undefined,
      description: typeof meta.description === 'string' ? (meta.description as string) : undefined,
    };
  }

  private extractSignatureRecordMessage(rpcParams: unknown): string | null {
    if (!Array.isArray(rpcParams) || rpcParams.length < 2) return null;

    const first = rpcParams[0];
    const second = rpcParams[1];

    const firstIsAddress = typeof first === 'string' && isEvmAddress(first, { strict: false });
    const secondIsAddress = typeof second === 'string' && isEvmAddress(second, { strict: false });

    if (firstIsAddress === secondIsAddress) return null;

    const payload = firstIsAddress ? second : first;

    if (typeof payload === 'string') return payload;

    if (payload && typeof payload === 'object' && typeof (payload as { raw?: unknown }).raw === 'string') {
      return (payload as { raw: string }).raw;
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
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
    metadata: { name: string; url: string; icons?: string[]; description?: string };
    origin: string;
    requestedEip155Chains: string[];
    methods: string[];
    events: string[];
  } {
    const proposer = proposal.params?.proposer;
    const meta = proposer?.metadata ?? {};
    const icons = Array.isArray(meta.icons) ? meta.icons.filter((x: unknown): x is string => typeof x === 'string') : undefined;

    const origin =
      typeof proposal.verifyContext?.verified?.origin === 'string' ? proposal.verifyContext.verified.origin : typeof meta.url === 'string' ? meta.url : '';

    const required = proposal.params?.requiredNamespaces ?? {};
    const optional = proposal.params?.optionalNamespaces ?? {};

    const requestedEip155ChainsSet = new Set<string>();

    const requiredMethodsSet = new Set<string>();
    const requiredEventsSet = new Set<string>();
    const optionalMethodsSet = new Set<string>();
    const optionalEventsSet = new Set<string>();

    let hasRequiredEip155 = false;

    const collect = (namespaces: Record<string, any>, options: { markRequired?: boolean; methods: Set<string>; events: Set<string> }) => {
      for (const key of Object.keys(namespaces)) {
        if (!key.startsWith('eip155')) continue;

        if (options.markRequired) hasRequiredEip155 = true;

        if (key.includes(':')) {
          requestedEip155ChainsSet.add(key);
          const ns = namespaces[key] ?? {};
          if (Array.isArray(ns.methods))
            ns.methods.forEach((m: unknown) => {
              typeof m === 'string' && options.methods.add(m);
            });
          if (Array.isArray(ns.events))
            ns.events.forEach((e: unknown) => {
              typeof e === 'string' && options.events.add(e);
            });
          continue;
        }

        const ns = namespaces[key] ?? {};
        if (Array.isArray(ns.chains))
          ns.chains.forEach((c: unknown) => {
            typeof c === 'string' && requestedEip155ChainsSet.add(c);
          });
        if (Array.isArray(ns.methods))
          ns.methods.forEach((m: unknown) => {
            typeof m === 'string' && options.methods.add(m);
          });
        if (Array.isArray(ns.events))
          ns.events.forEach((e: unknown) => {
            typeof e === 'string' && options.events.add(e);
          });
      }
    };

    collect(required as any, { markRequired: true, methods: requiredMethodsSet, events: requiredEventsSet });
    collect(optional as any, { methods: optionalMethodsSet, events: optionalEventsSet });

    const methods = hasRequiredEip155 ? requiredMethodsSet : optionalMethodsSet;
    const events = hasRequiredEip155 ? requiredEventsSet : optionalEventsSet;

    return {
      metadata: {
        name: typeof meta.name === 'string' ? meta.name : '',
        url: typeof meta.url === 'string' ? meta.url : '',
        icons,
        description: typeof meta.description === 'string' ? meta.description : undefined,
      },
      origin,
      requestedEip155Chains: Array.from(requestedEip155ChainsSet).filter((c) => c.startsWith('eip155:')),
      methods: Array.from(methods),
      events: Array.from(events),
    };
  }

  private async getSupportedRequiredChains(requiredEip155Chains: string[]): Promise<{ supported: string[]; unsupported: string[] }> {
    if (!this.networkService) {
      return { supported: [], unsupported: requiredEip155Chains };
    }

    const networks = await this.networkService.getAllNetworks();
    const supportedByWallet = new Set(networks.filter((n) => n.networkType === NetworkType.Ethereum).map((n) => `eip155:${n.netId}`));
    const supported =
      Array.isArray(this.allowedEip155Chains) && this.allowedEip155Chains.length > 0
        ? new Set(this.allowedEip155Chains.filter((chain) => supportedByWallet.has(chain)))
        : supportedByWallet;

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
