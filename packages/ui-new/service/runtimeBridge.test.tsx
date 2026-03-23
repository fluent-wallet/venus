import 'reflect-metadata';

import { type CoreEventMap, InMemoryEventBus } from '@core/modules/eventBus';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { getAccountRootKey, getCurrentAccountKey } from './account';
import { getAssetsByAddressKey } from './asset';
import { mockAccount, mockAsset } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
import { getNftItemsKey } from './nft';
import { useRuntimeEventBridge } from './runtimeBridge';
import { getSignatureRootKey } from './signature';

jest.mock('@react-navigation/native', () => ({
  StackActions: {
    replace: jest.fn(),
  },
}));

const mockGetRuntimeEventBus = jest.fn();
const mockGetAuthService = jest.fn();
const mockGetExternalRequestsService = jest.fn();
const mockGetBiometricVaultPassword = jest.fn();

jest.mock('./core', () => ({
  getAccountService: jest.fn(() => ({ getCurrentAccount: jest.fn() })),
  getAddressValidationService: jest.fn(() => ({ isContractAddress: jest.fn() })),
  getAuthService: () => mockGetAuthService(),
  getExternalRequestsService: () => mockGetExternalRequestsService(),
  getNetworkService: jest.fn(() => ({ getCurrentNetwork: jest.fn() })),
  getRuntimeEventBus: () => mockGetRuntimeEventBus(),
  getTransactionService: jest.fn(() => ({ isPendingTxsFull: jest.fn() })),
}));

jest.mock('./biometricVaultPasswordStore', () => ({
  getBiometricVaultPassword: (params: { promptTitle: string }) => mockGetBiometricVaultPassword(params),
}));

describe('runtimeBridge', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates signature queries on signature/changed', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient) as React.ComponentType<{ children: React.ReactNode }>;
    const eventBus = new InMemoryEventBus<CoreEventMap>();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const auth = { cancelPasswordRequest: jest.fn() };
    const externalRequests = { getActiveRequests: jest.fn(() => []) };

    mockGetRuntimeEventBus.mockReturnValue(eventBus);
    mockGetAuthService.mockReturnValue(auth);
    mockGetExternalRequestsService.mockReturnValue(externalRequests);

    const navigation = {
      canGoBack: jest.fn(() => false),
      dispatch: jest.fn(),
      getState: jest.fn(() => ({ routes: [] })),
      navigate: jest.fn(),
    } as Parameters<typeof useRuntimeEventBridge>[0];

    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() => {
      eventBus.emit('signature/changed', {
        addressId: 'addr_1',
        signatureId: 'sig_1',
        reason: 'created',
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getSignatureRootKey() });
    });
    expect(externalRequests.getActiveRequests).toHaveBeenCalledWith({ provider: 'wallet-connect' });
    expect(auth.cancelPasswordRequest).not.toHaveBeenCalled();
  });

  it('updates current account cache immediately on account/current-changed', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient) as React.ComponentType<{ children: React.ReactNode }>;
    const eventBus = new InMemoryEventBus<CoreEventMap>();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const auth = { cancelPasswordRequest: jest.fn() };
    const externalRequests = { getActiveRequests: jest.fn(() => []) };
    const nextAccount = { ...mockAccount, id: 'acc_2', nickname: 'Secondary', address: '0xdef', currentAddressId: 'addr_2' };

    mockGetRuntimeEventBus.mockReturnValue(eventBus);
    mockGetAuthService.mockReturnValue(auth);
    mockGetExternalRequestsService.mockReturnValue(externalRequests);

    const navigation = {
      canGoBack: jest.fn(() => false),
      dispatch: jest.fn(),
      getState: jest.fn(() => ({ routes: [] })),
      navigate: jest.fn(),
    } as Parameters<typeof useRuntimeEventBridge>[0];

    queryClient.setQueryData(getCurrentAccountKey(), mockAccount);

    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() => {
      eventBus.emit('account/current-changed', { account: nextAccount });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(getCurrentAccountKey())).toEqual(nextAccount);
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountRootKey(), refetchType: 'inactive' });
  });

  it('writes assets snapshot into address cache on assets-sync/succeeded', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient) as React.ComponentType<{ children: React.ReactNode }>;
    const eventBus = new InMemoryEventBus<CoreEventMap>();
    const auth = { cancelPasswordRequest: jest.fn() };
    const externalRequests = { getActiveRequests: jest.fn(() => []) };

    mockGetRuntimeEventBus.mockReturnValue(eventBus);
    mockGetAuthService.mockReturnValue(auth);
    mockGetExternalRequestsService.mockReturnValue(externalRequests);

    const navigation = {
      canGoBack: jest.fn(() => false),
      dispatch: jest.fn(),
      getState: jest.fn(() => ({ routes: [] })),
      navigate: jest.fn(),
    } as Parameters<typeof useRuntimeEventBridge>[0];

    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() => {
      eventBus.emit('assets-sync/succeeded', {
        key: { addressId: 'addr_1', networkId: 'net_1' },
        reason: 'manual',
        runId: 'run_1',
        timestampMs: Date.now(),
        updatedCount: 1,
        snapshot: { assets: [mockAsset] },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(getAssetsByAddressKey('addr_1'))).toEqual([mockAsset]);
    });
  });

  it('writes nft item snapshots into the targeted cache without invalidating nft queries', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient) as React.ComponentType<{ children: React.ReactNode }>;
    const eventBus = new InMemoryEventBus<CoreEventMap>();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const auth = { cancelPasswordRequest: jest.fn() };
    const externalRequests = { getActiveRequests: jest.fn(() => []) };

    mockGetRuntimeEventBus.mockReturnValue(eventBus);
    mockGetAuthService.mockReturnValue(auth);
    mockGetExternalRequestsService.mockReturnValue(externalRequests);

    const navigation = {
      canGoBack: jest.fn(() => false),
      dispatch: jest.fn(),
      getState: jest.fn(() => ({ routes: [] })),
      navigate: jest.fn(),
    } as Parameters<typeof useRuntimeEventBridge>[0];

    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() => {
      eventBus.emit('nft-sync/started', {
        key: { addressId: 'addr_1', networkId: 'net_1', contractAddress: '0xabc' },
        reason: 'poll',
        runId: 'run_1',
        timestampMs: Date.now(),
      });
      eventBus.emit('nft-sync/updated', {
        key: { addressId: 'addr_1', networkId: 'net_1', contractAddress: '0xabc' },
        reason: 'poll',
        runId: 'run_1',
        timestampMs: Date.now(),
        updatedCount: 1,
      });
      eventBus.emit('nft-sync/failed', {
        key: { addressId: 'addr_1', networkId: 'net_1', contractAddress: '0xabc' },
        reason: 'poll',
        runId: 'run_1',
        timestampMs: Date.now(),
        error: { code: 'NFT_SYNC_FETCH_FAILED', message: 'failed' },
      });
      eventBus.emit('nft-sync/succeeded', {
        key: { addressId: 'addr_1', networkId: 'net_1', contractAddress: '0xabc' },
        reason: 'poll',
        runId: 'run_1',
        timestampMs: Date.now(),
        updatedCount: 1,
        snapshot: {
          contractAddress: '0xabc',
          items: [{ tokenId: '1', name: 'NFT #1', amount: '1' }],
        },
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(getNftItemsKey('addr_1', '0xabc'))).toEqual([
        {
          tokenId: '1',
          name: 'NFT #1',
          description: null,
          icon: null,
          amount: '1',
        },
      ]);
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('resolves biometrics requests without routing to password verify', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient) as React.ComponentType<{ children: React.ReactNode }>;
    const eventBus = new InMemoryEventBus<CoreEventMap>();
    const auth = {
      cancelPasswordRequest: jest.fn(),
      resolvePassword: jest.fn(),
      rejectPasswordRequest: jest.fn(),
    };
    const externalRequests = { getActiveRequests: jest.fn(() => []) };

    mockGetRuntimeEventBus.mockReturnValue(eventBus);
    mockGetAuthService.mockReturnValue(auth);
    mockGetExternalRequestsService.mockReturnValue(externalRequests);
    mockGetBiometricVaultPassword.mockResolvedValue('vault-password');

    const navigation = {
      canGoBack: jest.fn(() => false),
      dispatch: jest.fn(),
      getState: jest.fn(() => ({ routes: [] })),
      navigate: jest.fn(),
    } as Parameters<typeof useRuntimeEventBridge>[0];

    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() => {
      eventBus.emit('auth/credential-requested', { requestId: 'auth_1', kind: 'biometrics' });
    });

    await waitFor(() => {
      expect(auth.resolvePassword).toHaveBeenCalledWith({ requestId: 'auth_1', password: 'vault-password' });
    });
    expect(navigation.navigate).not.toHaveBeenCalledWith('PasswordVerify', expect.anything());
    expect(auth.rejectPasswordRequest).not.toHaveBeenCalled();
  });
});
