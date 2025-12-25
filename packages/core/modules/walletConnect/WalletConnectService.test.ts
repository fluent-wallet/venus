import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
import { type CoreEventMap, type EventBus, InMemoryEventBus } from '@core/modules/eventBus';
import type { Logger } from '@core/runtime/types';
import type { WalletKitTypes } from '@reown/walletkit';
import { WalletConnectService } from './WalletConnectService';

type MockWalletKitClient = {
  on: (event: WalletKitTypes.Event, listener: (args: any) => void) => void;
  off: (event: WalletKitTypes.Event, listener: (args: any) => void) => void;
  getActiveSessions: () => Record<string, any>;
  core?: { relayer?: { transportClose?: () => Promise<void> } };
  __emit: (event: WalletKitTypes.Event, payload: any) => void;
};

const createMockClient = (options: { getActiveSessions: () => Record<string, any>; transportClose?: jest.Mock<Promise<void>, []> }) => {
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

  const client: MockWalletKitClient = {
    on: on as unknown as MockWalletKitClient['on'],
    off: off as unknown as MockWalletKitClient['off'],
    getActiveSessions: options.getActiveSessions,
    core: {
      relayer: {
        transportClose: options.transportClose as unknown as (() => Promise<void>) | undefined,
      },
    },
    __emit: __emit as unknown as MockWalletKitClient['__emit'],
  };

  return { client, on, off };
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
});
