import type { EventBus } from '@core/WalletCore/Events/eventTypes';
import {
  HARDWARE_SIGN_ABORT_EVENT,
  HARDWARE_SIGN_ERROR_EVENT,
  HARDWARE_SIGN_START_EVENT,
  HARDWARE_SIGN_SUCCESS_EVENT,
} from '@core/WalletCore/Events/eventTypes';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type React from 'react';
import { Subject } from 'rxjs';
import { getEventBus, getHardwareWalletService } from '../core';
import { createTestQueryClient, createWrapper } from '../mocks/reactQuery';
import { getHardwareSignStateKey, useBsimBackup, useBsimRestore, useBsimUpdatePin, useConnectHardware, useHardwareSigningEvents } from './index';

jest.mock('../core', () => ({
  getEventBus: jest.fn(),
  getHardwareWalletService: jest.fn(),
}));

class TestEventBus implements EventBus {
  private subjects = new Map<string, Subject<any>>();
  dispatch = jest.fn((type: any, payload: any) => {
    this.subject(type).next(payload);
  });

  on(type: any) {
    return this.subject(type).asObservable();
  }

  private subject(type: string) {
    const existing = this.subjects.get(type);
    if (existing) return existing;
    const created = new Subject<any>();
    this.subjects.set(type, created);
    return created;
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
      eventBus.dispatch(HARDWARE_SIGN_START_EVENT, {
        requestId: 'r1',
        accountId: 'a',
        addressId: 'addr_1',
        networkId: 'n',
        txPayload: { x: 1 },
      });

      // Late/foreign completion should not override current state
      eventBus.dispatch(HARDWARE_SIGN_SUCCESS_EVENT, {
        requestId: 'r0',
        accountId: 'a',
        addressId: 'addr_1',
        networkId: 'n',
        txHash: '0xold',
        rawTransaction: '0xold',
      });

      eventBus.dispatch(HARDWARE_SIGN_SUCCESS_EVENT, {
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
      eventBus.dispatch(HARDWARE_SIGN_START_EVENT, {
        requestId: 'r1',
        accountId: 'a',
        addressId: 'addr_other',
        networkId: 'n',
        txPayload: { x: 1 },
      });
    });

    expect(queryClient.getQueryData(getHardwareSignStateKey())).toBeUndefined();

    act(() => {
      eventBus.dispatch(HARDWARE_SIGN_START_EVENT, {
        requestId: 'r2',
        accountId: 'a',
        addressId: 'addr_target',
        networkId: 'n',
        txPayload: { x: 2 },
      });

      eventBus.dispatch(HARDWARE_SIGN_ERROR_EVENT, {
        requestId: 'r2',
        accountId: 'a',
        addressId: 'addr_target',
        networkId: 'n',
        error: { code: 'TIMEOUT', message: 'timeout' },
      });

      eventBus.dispatch(HARDWARE_SIGN_ABORT_EVENT, {
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
