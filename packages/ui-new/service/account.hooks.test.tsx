import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import {
  getAccountRootKey,
  getCurrentAccountKey,
  useCurrentAccount,
  useCurrentAddress,
  useSetAccountHidden,
  useSwitchAccount,
  useUpdateAccountNickname,
} from './account';
import { getAccountService } from './core';
import { mockAccount } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';

jest.mock('./core', () => ({
  getAccountService: jest.fn(),
}));

type AccountServiceMock = {
  getCurrentAccount: jest.Mock;
  switchAccount: jest.Mock;
  updateAccountNickName: jest.Mock;
  setAccountHidden: jest.Mock;
};

describe('account service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: AccountServiceMock;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      getCurrentAccount: jest.fn(),
      switchAccount: jest.fn().mockResolvedValue(undefined),
      updateAccountNickName: jest.fn().mockResolvedValue(undefined),
      setAccountHidden: jest.fn().mockResolvedValue(undefined),
    };
    (getAccountService as jest.Mock).mockReturnValue(service);
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useCurrentAccount caches data under getCurrentAccountKey', async () => {
    service.getCurrentAccount.mockResolvedValue(mockAccount);

    const { result } = renderHook(() => useCurrentAccount(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAccount);
    expect(queryClient.getQueryData(getCurrentAccountKey())).toEqual(mockAccount);
  });

  it('useCurrentAddress derives id/value from current account', async () => {
    service.getCurrentAccount.mockResolvedValue(mockAccount);

    const { result } = renderHook(() => useCurrentAddress(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 'addr_1', value: '0xabc' });
  });

  it('useCurrentAddress returns null when account has no current address', async () => {
    service.getCurrentAccount.mockResolvedValue({ ...mockAccount, currentAddressId: null });

    const { result } = renderHook(() => useCurrentAddress(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('useSwitchAccount calls service and invalidates account root key', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSwitchAccount(), { wrapper });

    await act(async () => {
      await result.current('acc_2');
    });

    expect(service.switchAccount).toHaveBeenCalledWith('acc_2');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountRootKey() });
  });

  it('useUpdateAccountNickname calls service and invalidates cache', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateAccountNickname(), { wrapper });

    await act(async () => {
      await result.current('acc_1', 'Renamed');
    });

    expect(service.updateAccountNickName).toHaveBeenCalledWith('acc_1', 'Renamed');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountRootKey() });
  });

  it('useSetAccountHidden calls service and invalidates cache', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSetAccountHidden(), { wrapper });

    await act(async () => {
      await result.current('acc_1', true);
    });

    expect(service.setAccountHidden).toHaveBeenCalledWith('acc_1', true);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountRootKey() });
  });

  describe('error handling', () => {
    it('useCurrentAccount handles service errors', async () => {
      const error = new Error('Database error');
      service.getCurrentAccount.mockRejectedValue(error);

      const { result } = renderHook(() => useCurrentAccount(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(error);
    });

    it('useSwitchAccount propagates errors', async () => {
      const error = new Error('Switch failed');
      service.switchAccount.mockRejectedValue(error);
      const { result } = renderHook(() => useSwitchAccount(), { wrapper });

      await expect(
        act(async () => {
          await result.current('acc_2');
        }),
      ).rejects.toThrow('Switch failed');
    });

    it('useUpdateAccountNickname propagates errors', async () => {
      const error = new Error('Update failed');
      service.updateAccountNickName.mockRejectedValue(error);
      const { result } = renderHook(() => useUpdateAccountNickname(), { wrapper });

      await expect(
        act(async () => {
          await result.current('acc_1', 'Renamed');
        }),
      ).rejects.toThrow('Update failed');
    });
  });
});
