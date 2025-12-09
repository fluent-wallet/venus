import { AssetType } from '@core/types';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { useCurrentAddress } from './account';
import { getTransactionService } from './core';
import { mockRecentlyAddress, mockTransaction } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
import {
  getRecentlyAddressesKey,
  getTransactionRootKey,
  getTransactionsByAddressKey,
  useFinishedTxsOfAddress,
  useRecentlyAddressesOfAddress,
  useRecentlyAddressesOfCurrentAddress,
  useSendERC20,
  useSendNative,
  useTransactionsOfAddress,
  useTransactionsOfCurrentAddress,
  useUnfinishedTxsOfAddress,
} from './transaction';

jest.mock('./core', () => ({
  getTransactionService: jest.fn(),
}));
jest.mock('./account', () => ({
  useCurrentAddress: jest.fn(),
}));

type TransactionServiceMock = {
  listTransactions: jest.Mock;
  getRecentlyAddresses: jest.Mock;
  sendNative: jest.Mock;
  sendERC20: jest.Mock;
};

describe('transaction service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: TransactionServiceMock;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      listTransactions: jest.fn().mockResolvedValue([mockTransaction]),
      getRecentlyAddresses: jest.fn().mockResolvedValue([mockRecentlyAddress]),
      sendNative: jest.fn().mockResolvedValue(mockTransaction),
      sendERC20: jest.fn().mockResolvedValue(mockTransaction),
    };
    (getTransactionService as jest.Mock).mockReturnValue(service);
    (useCurrentAddress as jest.Mock).mockReturnValue({ data: { id: 'addr_current' }, isSuccess: true });
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useTransactionsOfAddress caches data with composed key', async () => {
    const { result } = renderHook(() => useTransactionsOfAddress('addr_1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listTransactions).toHaveBeenCalledWith({ addressId: 'addr_1', status: 'all', limit: undefined });
    expect(queryClient.getQueryData(getTransactionsByAddressKey('addr_1', 'all', undefined))).toEqual([mockTransaction]);
  });

  it('useTransactionsOfCurrentAddress uses current address id', async () => {
    const { result } = renderHook(() => useTransactionsOfCurrentAddress({ status: 'pending' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listTransactions).toHaveBeenCalledWith({ addressId: 'addr_current', status: 'pending', limit: undefined });
  });

  it('unfinished and finished helpers set proper status', async () => {
    renderHook(() => useUnfinishedTxsOfAddress('addr_2'), { wrapper });
    renderHook(() => useFinishedTxsOfAddress('addr_3'), { wrapper });

    await waitFor(() => expect(service.listTransactions).toHaveBeenCalledWith({ addressId: 'addr_2', status: 'pending', limit: undefined }));
    await waitFor(() => expect(service.listTransactions).toHaveBeenCalledWith({ addressId: 'addr_3', status: 'finished', limit: undefined }));
  });

  it('useRecentlyAddressesOfAddress returns service data', async () => {
    const { result } = renderHook(() => useRecentlyAddressesOfAddress('addr_1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.getRecentlyAddresses).toHaveBeenCalledWith('addr_1', 20);
    expect(queryClient.getQueryData(getRecentlyAddressesKey('addr_1'))).toEqual([mockRecentlyAddress]);
  });

  it('useRecentlyAddressesOfCurrentAddress stays idle when no address', async () => {
    (useCurrentAddress as jest.Mock).mockReturnValue({ data: null });
    const { result } = renderHook(() => useRecentlyAddressesOfCurrentAddress(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(service.getRecentlyAddresses).not.toHaveBeenCalled();
  });

  it('useSendNative invalidates transaction and asset caches', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSendNative(), { wrapper });

    await act(async () => {
      await result.current({ addressId: 'addr_1', to: '0xbbb', amount: '1', assetType: AssetType.Native, assetDecimals: 18 });
    });

    expect(service.sendNative).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getTransactionRootKey() });
  });

  it('useSendERC20 invalidates caches after sending token transfer', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSendERC20(), { wrapper });

    await act(async () => {
      await result.current({ addressId: 'addr_1', contractAddress: '0xccc', to: '0xbbb', amount: '1', assetDecimals: 18 });
    });

    expect(service.sendERC20).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getTransactionRootKey() });
  });
});
