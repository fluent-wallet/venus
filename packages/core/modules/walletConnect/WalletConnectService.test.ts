import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
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

  const client: MockWalletKitClient = {
    on: on as unknown as MockWalletKitClient['on'],
    off: off as unknown as MockWalletKitClient['off'],
    getActiveSessions: options.getActiveSessions,
    approveSession: approveSession as unknown as MockWalletKitClient['approveSession'],
    rejectSession: rejectSession as unknown as MockWalletKitClient['rejectSession'],
    respondSessionRequest: respondSessionRequest as unknown as MockWalletKitClient['respondSessionRequest'],
    core: {
      relayer: {
        transportClose: options.transportClose as unknown as (() => Promise<void>) | undefined,
      },
    },
    __emit: __emit as unknown as MockWalletKitClient['__emit'],
  };

  return { client, on, off, approveSession, rejectSession, respondSessionRequest };
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
  await Promise.resolve();
  await Promise.resolve();
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

  beforeEach(() => {
    logger = createSilentLogger();
    eventBus = new InMemoryEventBus<CoreEventMap>({ logger });
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
    });

    await service.start();
    await service.stop();

    client.__emit('session_delete', { id: 1, topic: 't1' });

    expect(events).toEqual([{ reason: 'init' }]);
  });
  it('responds UNSUPPORTED_METHOD for unsupported session_request and does not enqueue ExternalRequests', async () => {
    const { client, respondSessionRequest } = createMockClient({ getActiveSessions: () => ({ t1: session('t1', 'https://a.example') }) });

    const requested: CoreEventMap['external-requests/requested'][] = [];
    eventBus.on('external-requests/requested', (payload) => requested.push(payload));

    const service = new WalletConnectService({
      eventBus,
      logger,
      clientFactory: async () => client as any,
      closeTransportOnStop: false,
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
      response: { id: 1, jsonrpc: '2.0', error: { code: -32000, message: 'UNSUPPORTED_METHOD' } },
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

    // 2) typedData_v4
    client.__emit('session_request', {
      id: 10,
      topic: 't1',
      params: {
        chainId: 'eip155:1',
        request: {
          method: 'eth_signTypedData_v4',
          params: [
            '0x0000000000000000000000000000000000000001',
            JSON.stringify({
              domain: { name: 'Test', version: '1', chainId: 1, verifyingContract: '0x0000000000000000000000000000000000000001' },
              primaryType: 'Mail',
              types: { EIP712Domain: [{ name: 'name', type: 'string' }], Mail: [{ name: 'contents', type: 'string' }] },
              message: { contents: 'hello' },
            }),
          ],
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

    // 3) chainId mismatch -> error message UNSUPPORTED_NETWORK on approve
    client.__emit('session_request', {
      id: 11,
      topic: 't1',
      params: { chainId: 'eip155:999', request: { method: 'personal_sign', params: ['0xdeadbeef', '0x0000000000000000000000000000000000000001'] } },
    } as unknown as WalletKitTypes.SessionRequest);
    await flushPromises();

    expect(requested).toHaveLength(3);
    externalRequests.approve({ requestId: requested[2].requestId });
    await flushPromises();

    expect(respondSessionRequest).toHaveBeenCalledTimes(3);
    expect(respondSessionRequest.mock.calls[2]?.[0]).toMatchObject({
      topic: 't1',
      response: { id: 11, jsonrpc: '2.0', error: { code: -32000, message: 'UNSUPPORTED_NETWORK' } },
    });

    await service.stop();
  });
});
