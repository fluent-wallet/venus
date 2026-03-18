import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import {
  getAccountRootKey,
  getCurrentAccountKey,
  useCurrentAccount,
  useCurrentAddress,
  useRemoveAccount,
  useSwitchAccount,
  useUpdateAccountNickname,
} from './account';
import { getAccountGroupRootKey } from './accountGroup';
import { getAccountGroupService, getAccountService, getAuthService, getVaultService } from './core';
import { mockAccount } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';

const mockDisconnectByAddresses = jest.fn();

jest.mock('./core', () => ({
  getAccountService: jest.fn(),
  getAccountGroupService: jest.fn(),
  getAuthService: jest.fn(),
  getVaultService: jest.fn(),
}));

jest.mock('./walletConnect', () => ({
  useDisconnectWalletConnectSessionsByAddresses: () => mockDisconnectByAddresses,
}));

type AccountServiceMock = {
  getCurrentAccount: jest.Mock;
  getAccountById: jest.Mock;
  switchAccount: jest.Mock;
  updateAccountNickName: jest.Mock;
  setAccountHidden: jest.Mock;
};

type AccountGroupServiceMock = {
  getGroup: jest.Mock;
};

describe('account service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: AccountServiceMock;
  let accountGroupService: AccountGroupServiceMock;
  let authService: { getPassword: jest.Mock };
  let vaultService: { deleteVault: jest.Mock };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      getCurrentAccount: jest.fn(),
      getAccountById: jest.fn(),
      switchAccount: jest.fn().mockResolvedValue(undefined),
      updateAccountNickName: jest.fn().mockResolvedValue(undefined),
      setAccountHidden: jest.fn().mockResolvedValue(undefined),
    };
    accountGroupService = {
      getGroup: jest.fn(),
    };
    authService = {
      getPassword: jest.fn().mockResolvedValue('pw'),
    };
    vaultService = {
      deleteVault: jest.fn().mockResolvedValue(undefined),
    };
    mockDisconnectByAddresses.mockReset();
    mockDisconnectByAddresses.mockResolvedValue(undefined);
    (getAccountService as jest.Mock).mockReturnValue(service);
    (getAccountGroupService as jest.Mock).mockReturnValue(accountGroupService);
    (getAuthService as jest.Mock).mockReturnValue(authService);
    (getVaultService as jest.Mock).mockReturnValue(vaultService);
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

  it('useSwitchAccount updates current account cache and only refetches inactive account queries', async () => {
    const targetAccount = { ...mockAccount, id: 'acc_2', nickname: 'Secondary', address: '0xdef', currentAddressId: 'addr_2', selected: false };
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    service.getAccountById.mockResolvedValue(targetAccount);
    const { result } = renderHook(() => useSwitchAccount(), { wrapper });

    await act(async () => {
      await result.current('acc_2');
    });

    expect(service.getAccountById).toHaveBeenCalledWith('acc_2');
    expect(service.switchAccount).toHaveBeenCalledWith('acc_2');
    expect(queryClient.getQueryData(getCurrentAccountKey())).toEqual({ ...targetAccount, selected: true });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountRootKey(), refetchType: 'inactive' });
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

  it('useRemoveAccount calls service and invalidates dependent caches', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    service.getAccountById.mockResolvedValue({ ...mockAccount, selected: false });
    accountGroupService.getGroup.mockResolvedValue({
      id: 'group_1',
      vaultId: 'vault_1',
      isGroup: true,
    });
    const { result } = renderHook(() => useRemoveAccount(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('acc_1');
    });

    expect(service.getAccountById).toHaveBeenCalledWith('acc_1');
    expect(accountGroupService.getGroup).toHaveBeenCalledWith('group_1', { includeHidden: true });
    expect(service.setAccountHidden).toHaveBeenCalledWith('acc_1', true);
    expect(mockDisconnectByAddresses).toHaveBeenCalledWith(['0xabc']);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountRootKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountGroupRootKey() });
    expect(vaultService.deleteVault).not.toHaveBeenCalled();
    expect(authService.getPassword).not.toHaveBeenCalled();
  });

  it('useRemoveAccount deletes non-group vault accounts after password check', async () => {
    service.getAccountById.mockResolvedValue({ ...mockAccount, selected: false, vaultType: 'public_address' });
    accountGroupService.getGroup.mockResolvedValue({
      id: 'group_1',
      vaultId: 'vault_1',
      isGroup: false,
    });
    const { result } = renderHook(() => useRemoveAccount(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('acc_1');
    });

    expect(authService.getPassword).toHaveBeenCalledTimes(1);
    expect(vaultService.deleteVault).toHaveBeenCalledWith('vault_1');
    expect(service.setAccountHidden).not.toHaveBeenCalled();
  });

  it('useRemoveAccount keeps the main removal successful when WalletConnect cleanup fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    service.getAccountById.mockResolvedValue({ ...mockAccount, selected: false });
    accountGroupService.getGroup.mockResolvedValue({
      id: 'group_1',
      vaultId: 'vault_1',
      isGroup: true,
    });
    mockDisconnectByAddresses.mockRejectedValue(new Error('disconnect failed'));
    const { result } = renderHook(() => useRemoveAccount(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('acc_1');
    });

    await waitFor(() => {
      expect(service.setAccountHidden).toHaveBeenCalledWith('acc_1', true);
    });
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });
    warnSpy.mockRestore();
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

    it('useRemoveAccount propagates errors', async () => {
      const error = new Error('Remove failed');
      service.getAccountById.mockRejectedValue(error);
      const { result } = renderHook(() => useRemoveAccount(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync('acc_1');
        }),
      ).rejects.toThrow('Remove failed');
    });
  });
});
