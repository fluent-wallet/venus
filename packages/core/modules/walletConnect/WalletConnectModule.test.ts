import 'reflect-metadata';

import { createSilentLogger } from '@core/__tests__/mocks';
import { CORE_IDENTIFIERS } from '@core/di';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import { EventBusModule } from '@core/modules/eventBus';
import { ModuleManager } from '@core/runtime/ModuleManager';
import { WalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';
import { Container } from 'inversify';
import { WalletConnectModule } from './WalletConnectModule';
import { WalletConnectService } from './WalletConnectService';

jest.mock('@walletconnect/core', () => {
  return {
    Core: jest.fn().mockImplementation((opts: any) => ({ __coreOpts: opts })),
  };
});

jest.mock('@reown/walletkit', () => {
  return {
    WalletKit: { init: jest.fn() },
  };
});

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

describe('WalletConnectModule', () => {
  it('starts, emits init, handles session_delete, and stops with transportClose', async () => {
    const listeners = new Map<string, Set<(args: any) => void>>();

    const mockClient: any = {
      on: jest.fn((event: string, listener: (args: any) => void) => {
        const set = listeners.get(event) ?? new Set();
        set.add(listener);
        listeners.set(event, set);
      }),
      off: jest.fn((event: string, listener: (args: any) => void) => {
        const set = listeners.get(event);
        if (!set) return;
        set.delete(listener);
      }),
      getActiveSessions: jest.fn(() => ({ t1: session('t1', 'https://a.example') })),
      core: { relayer: { transportClose: jest.fn().mockResolvedValue(undefined) } },
    };

    (WalletKit.init as unknown as jest.Mock).mockResolvedValue(mockClient);

    const container = new Container({ defaultScope: 'Singleton' });
    const manager = new ModuleManager({
      logger: createSilentLogger(),
      container,
      config: {
        walletConnect: {
          projectId: 'test_project_id',
          metadata: { name: 'test', description: 'test', url: 'https://test.example', icons: [] },
        },
      },
    });

    const busEvents: CoreEventMap['wallet-connect/sessions-changed'][] = [];
    manager.register([EventBusModule, WalletConnectModule]);
    await manager.start();

    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);
    eventBus.on('wallet-connect/sessions-changed', (payload) => busEvents.push(payload));

    const service = container.get(WalletConnectService);
    expect(service.getSessions().map((s) => s.topic)).toEqual(['t1']);

    expect((Core as unknown as jest.Mock).mock.calls[0]?.[0]).toEqual({ projectId: 'test_project_id' });
    expect((WalletKit.init as unknown as jest.Mock).mock.calls.length).toBe(1);

    const deleteListeners = listeners.get('session_delete');
    expect(deleteListeners?.size).toBe(1);

    mockClient.getActiveSessions.mockReturnValue({ t2: session('t2', 'https://b.example') });

    for (const fn of Array.from(deleteListeners ?? [])) fn({ id: 1, topic: 't1' });

    expect(service.getSessions().map((s) => s.topic)).toEqual(['t2']);

    await manager.stop();

    expect(mockClient.off).toHaveBeenCalledTimes(1);
    expect(mockClient.core.relayer.transportClose).toHaveBeenCalledTimes(1);
  });
});
