import 'reflect-metadata';

import { type CoreEventMap, InMemoryEventBus } from '@core/modules/eventBus';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
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

jest.mock('./core', () => ({
  getAccountService: jest.fn(() => ({ getCurrentAccount: jest.fn() })),
  getAddressValidationService: jest.fn(() => ({ isContractAddress: jest.fn() })),
  getAuthService: () => mockGetAuthService(),
  getExternalRequestsService: () => mockGetExternalRequestsService(),
  getNetworkService: jest.fn(() => ({ getCurrentNetwork: jest.fn() })),
  getRuntimeEventBus: () => mockGetRuntimeEventBus(),
  getTransactionService: jest.fn(() => ({ isPendingTxsFull: jest.fn() })),
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
});
