import 'reflect-metadata';

import { type CoreEventMap, InMemoryEventBus } from '@core/modules/eventBus';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getAccountListKey, getCurrentAccountKey } from './account';
import { getAssetsByAddressKey } from './asset';
import { mockAccount, mockAsset } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
import { getNftCollectionsByAddressKey, getNftItemsKey } from './nft';
import { useRuntimeEventBridge } from './runtimeBridge';
import { getSignatureRootKey } from './signature';
import { getTransactionRootKey } from './transaction';

jest.mock('@react-navigation/native', () => ({ StackActions: { replace: jest.fn() } }));

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
  let queryClient: QueryClient;
  let eventBus: InMemoryEventBus<CoreEventMap>;
  let wrapper: ReturnType<typeof createWrapper>;
  let navigation: Parameters<typeof useRuntimeEventBridge>[0];
  let auth: { cancelPasswordRequest: jest.Mock; resolvePassword: jest.Mock; rejectPasswordRequest: jest.Mock };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    eventBus = new InMemoryEventBus<CoreEventMap>();
    wrapper = createWrapper(queryClient);
    navigation = {
      canGoBack: jest.fn(() => false),
      dispatch: jest.fn(),
      getState: jest.fn(() => ({ routes: [] })),
      navigate: jest.fn(),
    } as unknown as typeof navigation;
    auth = { cancelPasswordRequest: jest.fn(), resolvePassword: jest.fn(), rejectPasswordRequest: jest.fn() };
    mockGetRuntimeEventBus.mockReturnValue(eventBus);
    mockGetAuthService.mockReturnValue(auth);
    mockGetExternalRequestsService.mockReturnValue({ getActiveRequests: jest.fn(() => []) });
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('invalidates signature queries on signature/changed', () => {
    queryClient.setQueryData(getSignatureRootKey(), []);
    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() => eventBus.emit('signature/changed', { addressId: 'addr_1', signatureId: 'sig_1', reason: 'created' }));

    expect(queryClient.getQueryState(getSignatureRootKey())?.isInvalidated).toBe(true);
  });

  it('updates the current account immediately and marks cached account lists stale', () => {
    const nextAccount = { ...mockAccount, id: 'acc_2', nickname: 'Secondary', address: '0xdef', currentAddressId: 'addr_2' };
    queryClient.setQueryData(getCurrentAccountKey(), mockAccount);
    queryClient.setQueryData(getAccountListKey(), [mockAccount]);
    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() => eventBus.emit('account/current-changed', { account: nextAccount }));

    expect(queryClient.getQueryData(getCurrentAccountKey())).toEqual(nextAccount);
    expect(queryClient.getQueryState(getAccountListKey())?.isInvalidated).toBe(true);
  });

  it('writes an assets snapshot into the address cache', () => {
    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() =>
      eventBus.emit('assets-sync/succeeded', {
        key: { addressId: 'addr_1', networkId: 'net_1' },
        reason: 'manual',
        runId: 'run_1',
        timestampMs: 0,
        updatedCount: 1,
        snapshot: { assets: [mockAsset] },
      }),
    );

    expect(queryClient.getQueryData(getAssetsByAddressKey('addr_1'))).toEqual([mockAsset]);
  });

  it('refreshes transactions on either transaction event and leaves NFT queries unchanged', () => {
    const transactionsKey = getTransactionRootKey();
    const directoryKey = getNftCollectionsByAddressKey('addr_1');
    const itemsKey = getNftItemsKey('addr_1', '0xabc');
    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    for (const event of ['tx/created', 'tx/updated'] as const) {
      for (const key of [transactionsKey, directoryKey, itemsKey]) queryClient.setQueryData(key, []);
      const key = { addressId: 'addr_1', networkId: 'net_1' };
      act(() => {
        if (event === 'tx/created') eventBus.emit(event, { key, txId: 'tx_1' });
        else eventBus.emit(event, { key, txIds: ['tx_1'], timestampMs: 0 });
      });
      expect(queryClient.getQueryState(transactionsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(directoryKey)?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(itemsKey)?.isInvalidated).toBe(false);
    }
  });

  it('resolves biometrics requests without routing to password verify', async () => {
    mockGetBiometricVaultPassword.mockResolvedValue('vault-password');
    renderHook(() => useRuntimeEventBridge(navigation), { wrapper });

    act(() => eventBus.emit('auth/credential-requested', { requestId: 'auth_1', kind: 'biometrics' }));

    await waitFor(() => expect(auth.resolvePassword).toHaveBeenCalledWith({ requestId: 'auth_1', password: 'vault-password' }));
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(auth.rejectPasswordRequest).not.toHaveBeenCalled();
  });
});
