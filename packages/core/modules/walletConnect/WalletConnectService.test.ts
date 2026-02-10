import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
import { SignType } from '@core/database/models/Signature/type';
import { type CoreEventMap, type EventBus, InMemoryEventBus } from '@core/modules/eventBus';
import { ExternalRequestsService } from '@core/modules/externalRequests';
import type { Logger, RuntimeScheduler } from '@core/runtime/types';
import { NetworkType } from '@core/types/chain';
import type { WalletKitTypes } from '@reown/walletkit';
import { WalletConnectService } from './WalletConnectService';

type MockWalletKitClient = {
  on: (event: WalletKitTypes.Event, listener: (args: any) => void) => void;
  off: (event: WalletKitTypes.Event, listener: (args: any) => void) => void;
  getActiveSessions: () => Record<string, any>;
  approveSession: (args: any) => Promise<any>;
  rejectSession: (args: any) => Promise<any>;
  respondSessionRequest: (args: any) => Promise<any>;
  pair: (args: any) => Promise<any>;
  disconnectSession: (args: any) => Promise<any>;
  core?: { relayer?: { transportClose?: () => Promise<void> } };
  __emit: (event: WalletKitTypes.Event, payload: any) => void;
};
const createMockClient = (options: {
  getActiveSessions: () => Record<string, any>;
  transportClose?: jest.Mock<Promise<void>, []>;
}): {
  client: MockWalletKitClient;
  on: jest.Mock;
  off: jest.Mock;
  approveSession: jest.Mock;
  rejectSession: jest.Mock;
  respondSessionRequest: jest.Mock;
  pair: jest.Mock;
  disconnectSession: jest.Mock;
} => {
  const handlers = new Map<string, Set<(args: any) => void>>();

  const on = jest.fn((event: string, listener: (args: any) => void) => {
    const set = handlers.get(event) ?? new Set();
    set.add(listener);
    handlers.set(event, set);
  });

  const off = jest.fn((event: string, listener: (args: any) => void) => {
    const set = handlers.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) handlers.delete(event);
  });

  const __emit = (event: string, payload: any) => {
    const set = handlers.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) fn(payload);
  };
  const approveSession = jest.fn().mockResolvedValue(undefined);
  const rejectSession = jest.fn().mockResolvedValue(undefined);
  const respondSessionRequest = jest.fn().mockResolvedValue(undefined);
  const pair = jest.fn().mockResolvedValue(undefined);
  const disconnectSession = jest.fn().mockResolvedValue(undefined);

  const client: MockWalletKitClient = {
    on: on as unknown as MockWalletKitClient['on'],
    off: off as unknown as MockWalletKitClient['off'],
    getActiveSessions: options.getActiveSessions,
    approveSession: approveSession as unknown as MockWalletKitClient['approveSession'],
    rejectSession: rejectSession as unknown as MockWalletKitClient['rejectSession'],
    respondSessionRequest: respondSessionRequest as unknown as MockWalletKitClient['respondSessionRequest'],
    pair: pair as unknown as MockWalletKitClient['pair'],
    disconnectSession: disconnectSession as unknown as MockWalletKitClient['disconnectSession'],
    core: {
      relayer: {
        transportClose: options.transportClose as unknown as (() => Promise<void>) | undefined,
      },
    },
    __emit: __emit as unknown as MockWalletKitClient['__emit'],
  };

  return { client, on, off, approveSession, rejectSession, respondSessionRequest, pair, disconnectSession };
};

const session = (topic: string, url: string) => {
  return {
    topic,
    peer: { metadata: { name: 'dapp', url, icons: ['https://example.com/icon.png'] } },
    namespaces: {
      eip155: {
        accounts: [`eip155:1:0x${topic.padEnd(40, '0')}`],
        chains: ['eip155:1'],
        methods: ['personal_sign'],
        events: [],
      },
    },
  };
};

const createScheduler = (): RuntimeScheduler => {
  return {
    setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
    clearInterval: (id) => clearInterval(id),
  };
};

const flushPromises = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
};

const makeProposal = (params: { id: number; chains: string[]; url?: string }) => {
  return {
    id: params.id,
    params: {
      id: params.id,
      proposer: { metadata: { name: 'dapp', url: params.url ?? 'https://dapp.example', icons: ['https://example.com/icon.png'] } },
      requiredNamespaces: {
        eip155: {
          chains: params.chains,
          methods: ['personal_sign'],
          events: [],
        },
      },
      optionalNamespaces: {},
    },
    verifyContext: { verified: { origin: params.url ?? 'https://dapp.example' } },
  } as any;
};
describe('WalletConnectService', () => {
  let eventBus: EventBus<CoreEventMap>;
  let logger: Logger;
  let signingService: any;

  beforeEach(() => {
    logger = createSilentLogger();
    eventBus = new InMemoryEventBus<CoreEventMap>({ logger });
    signingService = {
      signPersonalMessage: jest.fn(),
      signTypedDataV4: jest.fn(),
    };
  });

  it('emits init and refreshes sessions on session_delete', async () => {
    const transportClose = jest.fn().mockResolvedValue(undefined);

    let activeSessions: Record<string, ReturnType<typeof session>> = { t1: session('t1', 'https://a.example') };
    const { client } = createMockClient({ getActiveSessions: () => activeSessions, transportClose });

    const events: CoreEventMap['wallet-connect/sessions-changed'][] = [];
    eventBus.on('wallet-connect/sessions-changed', (payload) => events.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: true,
      signingService,
    });

    await service.start();

    expect(service.getSessions().map((s) => s.topic)).toEqual(['t1']);
    expect(events).toEqual([{ reason: 'init' }]);

    activeSessions = { t2: session('t2', 'https://b.example') };

    client.__emit('session_delete', { id: 1, topic: 't1' });
    await Promise.resolve();

    expect(service.getSessions().map((s) => s.topic)).toEqual(['t2']);
    expect(events).toEqual([{ reason: 'init' }, { reason: 'session_delete', topic: 't1' }]);

    await service.stop();

    expect(transportClose).toHaveBeenCalledTimes(1);
  });

  it('removes listener on stop (no more events after stop)', async () => {
    const { client } = createMockClient({ getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }) });

    const events: CoreEventMap['wallet-connect/sessions-changed'][] = [];
    eventBus.on('wallet-connect/sessions-changed', (payload) => events.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      signingService,
    });

    await service.start();
    await service.stop();

    client.__emit('session_delete', { id: 1, topic: 't1' });

    expect(events).toEqual([{ reason: 'init' }]);
  });

  it('responds 4200 Unsupported method for unsupported session_request and does not enqueue ExternalRequests', async () => {
    const { client, respondSessionRequest } = createMockClient({ getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }) });
    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      signingService,
    });

    await service.start();

    client.__emit('session_request', {
      id: 1,
      topic: 't1',
      params: { chainId: 'eip155:1', request: { method: 'eth_sign', params: [] } },
    });

    await flushPromises();

    expect(requested).toHaveLength(0);
    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest.mock.calls[0]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 1, jsonrpc: '2.0', error: { code: 4200, message: 'Unsupported method.' } },
    });

    await service.stop();
  });

  it('turns session_proposal into ExternalRequests and approves via WC SDK', async () => {
    const logger: Logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const { client, approveSession, rejectSession } = createMockClient({ getActiveSessions: () => ({}) });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const networkService = {
      getAllNetworks: async () => [{ networkType: NetworkType.Ethereum, netId: 1 }],
      getCurrentNetwork: async () => ({ networkType: NetworkType.Ethereum }),
    } as any;

    const accountService = {
      getCurrentAccount: async () => ({ address: '0x0000000000000000000000000000000000000001' }),
    } as any;

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      networkService,
      accountService,
      signingService,
    } as any);

    await service.start();

    client.__emit('session_proposal', makeProposal({ id: 123, chains: ['eip155:1'] }));
    await flushPromises();

    expect(requested).toHaveLength(1);
    expect(requested[0].request.kind).toBe('session_proposal');

    externalRequests.approve({ requestId: requested[0].requestId });
    await flushPromises();

    expect(approveSession).toHaveBeenCalledTimes(1);
    expect(rejectSession).toHaveBeenCalledTimes(0);

    await service.stop();
  });

  it('rejects immediately when required chains are not supported (no ExternalRequests)', async () => {
    const logger: Logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const { client, approveSession, rejectSession } = createMockClient({ getActiveSessions: () => ({}) });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const networkService = {
      getAllNetworks: async () => [{ networkType: NetworkType.Ethereum, netId: 1 }],
      getCurrentNetwork: async () => ({ networkType: NetworkType.Ethereum }),
    } as any;

    const accountService = {
      getCurrentAccount: async () => ({ address: '0x0000000000000000000000000000000000000001' }),
    } as any;

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      networkService,
      accountService,
      signingService,
    } as any);

    await service.start();

    client.__emit('session_proposal', makeProposal({ id: 124, chains: ['eip155:999'] }));
    await flushPromises();

    expect(requested).toHaveLength(0);
    expect(approveSession).toHaveBeenCalledTimes(0);
    expect(rejectSession).toHaveBeenCalledTimes(1);

    await service.stop();
  });

  it('rejects on approve when current network is not EVM (fallback safety)', async () => {
    const logger: Logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const { client, approveSession, rejectSession } = createMockClient({ getActiveSessions: () => ({}) });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const networkService = {
      getAllNetworks: async () => [{ networkType: NetworkType.Ethereum, netId: 1 }],
      getCurrentNetwork: async () => ({ networkType: NetworkType.Conflux }),
    } as any;

    const accountService = {
      getCurrentAccount: async () => ({ address: '0x0000000000000000000000000000000000000001' }),
    } as any;

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      networkService,
      accountService,
      signingService,
    } as any);

    await service.start();

    client.__emit('session_proposal', makeProposal({ id: 125, chains: ['eip155:1'] }));
    await flushPromises();

    expect(requested).toHaveLength(1);

    externalRequests.approve({ requestId: requested[0].requestId });
    await flushPromises();

    expect(approveSession).toHaveBeenCalledTimes(0);
    expect(rejectSession).toHaveBeenCalledTimes(1);

    const warnCalls = (logger.warn as jest.Mock).mock.calls;
    expect(JSON.stringify(warnCalls)).toContain('WC_UNSUPPORTED_NETWORK');

    await service.stop();
  });

  it('routes session_request(sign) via ExternalRequests, does not crash without verifyContext, and responds with result/error', async () => {
    const { client, respondSessionRequest } = createMockClient({
      getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }),
    });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const networkService = {
      getCurrentNetwork: async () => ({ networkType: NetworkType.Ethereum, netId: 1 }),
      getAllNetworks: async () => [{ networkType: NetworkType.Ethereum, netId: 1 }],
    } as unknown as any;

    const accountService = {
      getCurrentAccount: async () => ({ id: 'acc1', currentAddressId: 'addr1', address: '0x0000000000000000000000000000000000000001' }),
    } as unknown as any;

    const signingService = {
      signPersonalMessage: jest.fn().mockResolvedValue('0xsig_personal'),
      signTypedDataV4: jest.fn().mockResolvedValue('0xsig_typed'),
    } as unknown as any;

    const transactionService = {
      sendDappTransaction: jest.fn().mockResolvedValue({ id: 'tx1', hash: '0xhash_dapp' }),
    } as unknown as any;

    const signatureRecordService = {
      createRecord: jest.fn().mockResolvedValue({ id: 'sig1' }),
    } as unknown as any;

    const requested: CoreEventMap['external-requests/requested'][] = [];

    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      networkService,
      accountService,
      signingService,
      transactionService,
      signatureRecordService,
    } as any);

    await service.start();

    // 1) personal_sign, verifyContext omitted -> should not crash, origin falls back to session metadata.url
    client.__emit('session_request', {
      id: 9,
      topic: 't1',
      params: {
        chainId: 'eip155:1',
        request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] },
      },
    } as unknown as WalletKitTypes.SessionRequest);
    await flushPromises();

    expect(requested).toHaveLength(1);
    expect(requested[0].request.kind).toBe('session_request');
    expect(requested[0].request.origin).toBe('https://a.example');

    externalRequests.approve({ requestId: requested[0].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest.mock.calls[0]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 9, jsonrpc: '2.0', result: '0xsig_personal' },
    });

    expect(signatureRecordService.createRecord).toHaveBeenCalledTimes(1);
    expect(signatureRecordService.createRecord).toHaveBeenCalledWith({ addressId: 'addr1', signType: SignType.STR, message: '0xdeadbeef' });

    // 2) typedData_v4
    const typedDataJson = JSON.stringify({
      domain: { name: 'Test', version: '1', chainId: 1, verifyingContract: '0x0000000000000000000000000000000000000001' },
      primaryType: 'Mail',
      types: { EIP712Domain: [{ name: 'name', type: 'string' }], Mail: [{ name: 'contents', type: 'string' }] },
      message: { contents: 'hello' },
    });

    client.__emit('session_request', {
      id: 10,
      topic: 't1',
      params: {
        chainId: 'eip155:1',
        request: {
          method: 'eth_signTypedData_v4',
          params: ['0x0000000000000000000000000000000000000001', typedDataJson],
        },
      },
    } as unknown as WalletKitTypes.SessionRequest);
    await flushPromises();

    expect(requested).toHaveLength(2);
    externalRequests.approve({ requestId: requested[1].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(2);
    expect(respondSessionRequest.mock.calls[1]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 10, jsonrpc: '2.0', result: '0xsig_typed' },
    });

    expect(signatureRecordService.createRecord).toHaveBeenCalledTimes(2);
    expect(signatureRecordService.createRecord).toHaveBeenCalledWith({ addressId: 'addr1', signType: SignType.JSON, message: typedDataJson });

    // 3) eth_sendTransaction
    client.__emit('session_request', {
      id: 12,
      topic: 't1',
      params: {
        chainId: 'eip155:1',
        request: {
          method: 'eth_sendTransaction',
          params: [
            {
              from: '0x0000000000000000000000000000000000000001',
              to: '0x0000000000000000000000000000000000000002',
              data: '0x',
              value: '0x0',
              gas: '0x5208',
            },
          ],
        },
      },
    } as unknown as WalletKitTypes.SessionRequest);
    await flushPromises();

    expect(requested).toHaveLength(3);
    externalRequests.approve({ requestId: requested[2].requestId });
    await flushPromises();

    expect(transactionService.sendDappTransaction).toHaveBeenCalledTimes(1);
    expect(transactionService.sendDappTransaction).toHaveBeenCalledWith({
      addressId: 'addr1',
      request: expect.objectContaining({ from: '0x0000000000000000000000000000000000000001' }),
    });

    expect(respondSessionRequest).toHaveBeenCalledTimes(3);
    expect(respondSessionRequest.mock.calls[2]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 12, jsonrpc: '2.0', result: '0xhash_dapp' },
    });

    // 4) chainId mismatch -> error code 4902 on approve
    client.__emit('session_request', {
      id: 11,
      topic: 't1',
      params: { chainId: 'eip155:999', request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] } },
    } as unknown as WalletKitTypes.SessionRequest);
    await flushPromises();

    expect(requested).toHaveLength(4);
    externalRequests.approve({ requestId: requested[3].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(4);
    expect(respondSessionRequest.mock.calls[3]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 11, jsonrpc: '2.0', error: { code: 4902, message: 'Unrecognized chain ID.' } },
    });

    await service.stop();
  });

  it('responds -32602 Invalid params for eth_sendTransaction and does not call TransactionService', async () => {
    const { client, respondSessionRequest } = createMockClient({ getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }) });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const networkService = {
      getCurrentNetwork: async () => ({ networkType: NetworkType.Ethereum, netId: 1 }),
      getAllNetworks: async () => [{ networkType: NetworkType.Ethereum, netId: 1 }],
    } as unknown as any;

    const accountService = {
      getCurrentAccount: async () => ({ id: 'acc1', currentAddressId: 'addr1', address: '0x0000000000000000000000000000000000000001' }),
    } as unknown as any;

    const transactionService = {
      sendDappTransaction: jest.fn(),
    } as unknown as any;

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      networkService,
      accountService,
      signingService,
      transactionService,
    } as any);

    await service.start();

    client.__emit('session_request', {
      id: 20,
      topic: 't1',
      params: { chainId: 'eip155:1', request: { method: 'eth_sendTransaction', params: [] } },
    } as unknown as WalletKitTypes.SessionRequest);
    await flushPromises();
    externalRequests.approve({ requestId: requested[0].requestId });
    await flushPromises();

    expect(transactionService.sendDappTransaction).toHaveBeenCalledTimes(0);
    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest.mock.calls[0]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 20, jsonrpc: '2.0', error: { code: -32602, message: 'Invalid params.' } },
    });

    await service.stop();
  });

  it('keeps same-session serial (same topic) and advances FIFO on approve', async () => {
    const { client, respondSessionRequest } = createMockClient({
      getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }),
    });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const networkService = {
      getCurrentNetwork: async () => ({ networkType: NetworkType.Ethereum, netId: 1 }),
    } as unknown as any;

    const accountService = {
      getCurrentAccount: async () => ({ id: 'acc1', currentAddressId: 'addr1' }),
    } as unknown as any;

    const signingService = {
      signPersonalMessage: jest.fn().mockResolvedValue('0xsig_personal'),
    } as unknown as any;

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      networkService,
      accountService,
      signingService,
    } as any);

    await service.start();

    client.__emit('session_request', {
      id: 1,
      topic: 't1',
      params: {
        chainId: 'eip155:1',
        request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] },
      },
    } as unknown as WalletKitTypes.SessionRequest);

    client.__emit('session_request', {
      id: 2,
      topic: 't1',
      params: {
        chainId: 'eip155:1',
        request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] },
      },
    } as unknown as WalletKitTypes.SessionRequest);

    await flushPromises();

    expect(requested).toHaveLength(1);
    expect(requested[0].request).toMatchObject({ kind: 'session_request', sessionId: 't1' });

    externalRequests.approve({ requestId: requested[0].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest.mock.calls[0]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 1, jsonrpc: '2.0', result: '0xsig_personal' },
    });

    expect(requested).toHaveLength(2);

    externalRequests.approve({ requestId: requested[1].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(2);
    expect(respondSessionRequest.mock.calls[1]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 2, jsonrpc: '2.0', result: '0xsig_personal' },
    });

    await service.stop();
    externalRequests.stop();
  });

  it('enforces global serial (maxActiveRequests=1) across sessions and advances on approve', async () => {
    const { client, respondSessionRequest } = createMockClient({
      getActiveSessions: () => ({
        t1: session('t1', 'https://a.example'),
        t2: session('t2', 'https://b.example'),
      }),
    });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const networkService = {
      getCurrentNetwork: async () => ({ networkType: NetworkType.Ethereum, netId: 1 }),
    } as unknown as any;

    const accountService = {
      getCurrentAccount: async () => ({ id: 'acc1', currentAddressId: 'addr1' }),
    } as unknown as any;

    const signingService = {
      signPersonalMessage: jest.fn().mockResolvedValue('0xsig_personal'),
    } as unknown as any;

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      networkService,
      accountService,
      signingService,
    } as any);

    await service.start();

    client.__emit('session_request', {
      id: 1,
      topic: 't1',
      params: {
        chainId: 'eip155:1',
        request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] },
      },
    } as unknown as WalletKitTypes.SessionRequest);

    client.__emit('session_request', {
      id: 2,
      topic: 't2',
      params: {
        chainId: 'eip155:1',
        request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] },
      },
    } as unknown as WalletKitTypes.SessionRequest);

    await flushPromises();

    expect(requested).toHaveLength(1);
    expect(requested[0].request).toMatchObject({ kind: 'session_request', sessionId: 't1' });

    externalRequests.approve({ requestId: requested[0].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest.mock.calls[0]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 1, jsonrpc: '2.0', result: '0xsig_personal' },
    });

    expect(requested).toHaveLength(2);
    expect(requested[1].request).toMatchObject({ kind: 'session_request', sessionId: 't2' });

    externalRequests.approve({ requestId: requested[1].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(2);
    expect(respondSessionRequest.mock.calls[1]?.[0]).toMatchObject({
      topic: 't2',
      response: { id: 2, jsonrpc: '2.0', result: '0xsig_personal' },
    });

    await service.stop();
    externalRequests.stop();
  });

  it('rejects via TTL sweep and responds with EIP-1193 compatible error code', async () => {
    jest.useFakeTimers();

    const { client, respondSessionRequest } = createMockClient({
      getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }),
    });

    let now = 1_700_000_000_000;

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => now,
      logger,
      defaultTtlMs: 50,
      sweepIntervalMs: 10,
      maxActiveRequests: 1,
    });

    externalRequests.start();

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      signingService,
    } as any);

    await service.start();

    client.__emit('session_request', {
      id: 1,
      topic: 't1',
      params: { chainId: 'eip155:1', request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] } },
    } as unknown as WalletKitTypes.SessionRequest);

    await flushPromises();

    expect(requested).toHaveLength(1);

    now += 60;
    jest.advanceTimersByTime(60);
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest.mock.calls[0]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 1, jsonrpc: '2.0', error: { code: 4001, message: 'Request expired.' } },
    });
    await service.stop();
    externalRequests.stop();
    jest.useRealTimers();
  });

  it('responds Request canceled when ExternalRequestsService stops while WalletConnectService is running', async () => {
    const { client, respondSessionRequest } = createMockClient({
      getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }),
    });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      signingService,
    } as any);

    await service.start();

    client.__emit('session_request', {
      id: 1,
      topic: 't1',
      params: { chainId: 'eip155:1', request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] } },
    } as unknown as WalletKitTypes.SessionRequest);

    await flushPromises();
    expect(requested).toHaveLength(1);

    externalRequests.stop();
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest.mock.calls[0]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 1, jsonrpc: '2.0', error: { code: 4001, message: 'Request canceled.' } },
    });

    await service.stop();
  });

  it('does not respond if approved after WalletConnectService.stop()', async () => {
    const { client, respondSessionRequest } = createMockClient({
      getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }),
    });

    const externalRequests = new ExternalRequestsService({
      eventBus,
      scheduler: createScheduler(),
      now: () => 1_700_000_000_000,
      logger,
      defaultTtlMs: 10_000,
      sweepIntervalMs: 10_000,
      maxActiveRequests: 1,
    });

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      externalRequests,
      signingService,
    } as any);

    await service.start();

    client.__emit('session_request', {
      id: 1,
      topic: 't1',
      params: { chainId: 'eip155:1', request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] } },
    } as unknown as WalletKitTypes.SessionRequest);

    await flushPromises();

    expect(requested).toHaveLength(1);

    await service.stop();

    externalRequests.approve({ requestId: requested[0].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(0);

    externalRequests.stop();
  });

  it('pair() rejects non-wc: uri with WC_PAIR_FAILED', async () => {
    const { client } = createMockClient({ getActiveSessions: () => ({}) });

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      signingService,
    });

    await expect(service.pair('http://example.com')).rejects.toMatchObject({ code: 'WC_PAIR_FAILED' });
  });

  it('pair() rejects wc v1 uri with WC_PAIR_URI_VERSION_NOT_SUPPORTED', async () => {
    const { client } = createMockClient({ getActiveSessions: () => ({}) });

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      signingService,
    });

    const v1 =
      'wc:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    await expect(service.pair(v1)).rejects.toMatchObject({ code: 'WC_PAIR_URI_VERSION_NOT_SUPPORTED' });
  });

  it('pair() maps Pairing already exists to WC_PAIRING_ALREADY_EXISTS', async () => {
    const { client, pair } = createMockClient({ getActiveSessions: () => ({}) });
    pair.mockRejectedValueOnce(new Error('Pairing already exists'));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      signingService,
    });

    const v2 =
      'wc:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    await expect(service.pair(v2)).rejects.toMatchObject({ code: 'WC_PAIRING_ALREADY_EXISTS' });
  });

  it("disconnect() emits sessions-changed with reason 'disconnect'", async () => {
    const { client, disconnectSession } = createMockClient({ getActiveSessions: () => ({}) });

    const events: CoreEventMap['wallet-connect/sessions-changed'][] = [];
    eventBus.on('wallet-connect/sessions-changed', (payload) => events.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
      signingService,
    });

    await service.disconnect('t1');

    expect(disconnectSession).toHaveBeenCalledTimes(1);
    expect(events).toEqual([{ reason: 'init' }, { reason: 'disconnect', topic: 't1' }]);
  });
});
