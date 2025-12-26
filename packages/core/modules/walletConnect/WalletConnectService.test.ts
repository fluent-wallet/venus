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
  const client: MockWalletKitClient = {
    on: on as unknown as MockWalletKitClient['on'],
    off: off as unknown as MockWalletKitClient['off'],
    getActiveSessions: options.getActiveSessions,
    approveSession: approveSession as unknown as MockWalletKitClient['approveSession'],
    rejectSession: rejectSession as unknown as MockWalletKitClient['rejectSession'],
    core: {
      relayer: {
        transportClose: options.transportClose as unknown as (() => Promise<void>) | undefined,
      },
    },
    __emit: __emit as unknown as MockWalletKitClient['__emit'],
  };

  return { client, on, off, approveSession, rejectSession };
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
});
