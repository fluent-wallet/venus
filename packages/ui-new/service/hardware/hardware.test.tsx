import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type React from 'react';
import { getEventBus, getHardwareWalletService } from '../core';
import { createTestQueryClient, createWrapper } from '../mocks/reactQuery';
import { getHardwareSignStateKey, useBsimBackup, useBsimRestore, useBsimUpdatePin, useConnectHardware, useHardwareSigningEvents } from './index';

jest.mock('../core', () => ({
  getEventBus: jest.fn(),
  getHardwareWalletService: jest.fn(),
}));

class TestEventBus implements EventBus<CoreEventMap> {
  private handlers = new Map<string, Set<(payload: any) => void>>();

  on(event: any, handler: (payload: any) => void) {
    const key = String(event);
    const set = this.handlers.get(key) ?? new Set<(payload: any) => void>();
    if (!this.handlers.has(key)) this.handlers.set(key, set);
    set.add(handler);

    return {
      unsubscribe: () => {
        const current = this.handlers.get(key);
        if (!current) return;
        current.delete(handler);
        if (current.size === 0) this.handlers.delete(key);
      },
    };
  }

  emit(event: any, payload?: any) {
    const key = String(event);
    const set = this.handlers.get(key);
    if (!set) return;
    for (const handler of Array.from(set)) handler(payload ?? null);
  }
}

describe('hardware service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;

  let eventBus: TestEventBus;

  const service = {
    connectAndSync: jest.fn(),
    runUpdatePin: jest.fn(),
    runBackupSeed: jest.fn(),
    runRestoreSeed: jest.fn(),
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);

    eventBus = new TestEventBus();

    (getEventBus as unknown as jest.Mock).mockReturnValue(eventBus);
    (getHardwareWalletService as unknown as jest.Mock).mockReturnValue(service);

    service.connectAndSync.mockResolvedValue({ accounts: [], deviceId: 'd1' });
    service.runUpdatePin.mockResolvedValue('ok');
    service.runBackupSeed.mockResolvedValue('backup');
    service.runRestoreSeed.mockResolvedValue('ok');
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('writes sign state into global query cache and ignores mismatched requestId updates', async () => {
    renderHook(() => useHardwareSigningEvents(), { wrapper });

    act(() => {
      eventBus.emit('hardware-sign/started', {
        requestId: 'r1',
        accountId: 'a',
        addressId: 'addr_1',
        networkId: 'n',
      });

      // Late/foreign completion should not override current state
      eventBus.emit('hardware-sign/succeeded', {
        requestId: 'r0',
        accountId: 'a',
        addressId: 'addr_1',
        networkId: 'n',
        txHash: '0xold',
        rawTransaction: '0xold',
      });

      eventBus.emit('hardware-sign/succeeded', {
        requestId: 'r1',
        accountId: 'a',
        addressId: 'addr_1',
        networkId: 'n',
        txHash: '0xhash',
        rawTransaction: '0xraw',
      });
    });

    const state = queryClient.getQueryData(getHardwareSignStateKey()) as any;
    expect(state.phase).toBe('success');
    expect(state.requestId).toBe('r1');
    expect(state.txHash).toBe('0xhash');
  });

  it('useConnectHardware calls service.connectAndSync', async () => {
    const { result } = renderHook(() => useConnectHardware(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ type: 'BSIM', options: { deviceIdentifier: 'd1' } as any });
    });

    expect(service.connectAndSync).toHaveBeenCalledWith('BSIM', { deviceIdentifier: 'd1' });
  });

  it('BSIM mutations call HardwareWalletService methods', async () => {
    const { result: updatePin } = renderHook(() => useBsimUpdatePin(), { wrapper });
    const { result: backup } = renderHook(() => useBsimBackup(), { wrapper });
    const { result: restore } = renderHook(() => useBsimRestore(), { wrapper });

    await act(async () => {
      await updatePin.current.mutateAsync({ vaultId: 'v1' });
      await backup.current.mutateAsync({ vaultId: 'v1', params: {} as any });
      await restore.current.mutateAsync({ vaultId: 'v1', params: {} as any });
    });

    expect(service.runUpdatePin).toHaveBeenCalledWith('v1', undefined);
    expect(service.runBackupSeed).toHaveBeenCalledWith('v1', {} as any, undefined);
    expect(service.runRestoreSeed).toHaveBeenCalledWith('v1', {} as any, undefined);
  });

  it('filters events by addressId when provided', async () => {
    renderHook(() => useHardwareSigningEvents('addr_target'), { wrapper });

    act(() => {
      eventBus.emit('hardware-sign/started', {
        requestId: 'r1',
        accountId: 'a',
        addressId: 'addr_other',
        networkId: 'n',
      });
    });

    expect(queryClient.getQueryData(getHardwareSignStateKey())).toBeUndefined();

    act(() => {
      eventBus.emit('hardware-sign/started', {
        requestId: 'r2',
        accountId: 'a',
        addressId: 'addr_target',
        networkId: 'n',
      });

      eventBus.emit('hardware-sign/failed', {
        requestId: 'r2',
        accountId: 'a',
        addressId: 'addr_target',
        networkId: 'n',
        error: { code: 'TIMEOUT', message: 'timeout' },
      });

      eventBus.emit('hardware-sign/aborted', {
        requestId: 'r3',
        accountId: 'a',
        addressId: 'addr_target',
        networkId: 'n',
      });
    });

    const state = queryClient.getQueryData(getHardwareSignStateKey()) as any;
    expect(state.phase).toBe('error'); // abort has mismatched requestId, should be ignored
    expect(state.requestId).toBe('r2');
  });
});
