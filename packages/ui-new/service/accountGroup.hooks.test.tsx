import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { getAccountGroupRootKey, useRemoveAccountGroup } from './accountGroup';
import { getAccountGroupService, getAccountService, getAuthService, getVaultService } from './core';
import { mockAccount } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';

const mockDisconnectByAddresses = jest.fn();

jest.mock('./core', () => ({
  getAccountGroupService: jest.fn(),
  getAccountService: jest.fn(),
  getAuthService: jest.fn(),
  getVaultService: jest.fn(),
}));

jest.mock('./walletConnect', () => ({
  useDisconnectWalletConnectSessionsByAddresses: () => mockDisconnectByAddresses,
}));

describe('account group service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let accountGroupService: { getGroup: jest.Mock };
  let accountService: { getAccountsByGroup: jest.Mock };
  let authService: { getPassword: jest.Mock };
  let vaultService: { deleteVault: jest.Mock };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    accountGroupService = {
      getGroup: jest.fn(),
    };
    accountService = {
      getAccountsByGroup: jest.fn(),
    };
    authService = {
      getPassword: jest.fn().mockResolvedValue('pw'),
    };
    vaultService = {
      deleteVault: jest.fn().mockResolvedValue(undefined),
    };
    mockDisconnectByAddresses.mockReset();
    mockDisconnectByAddresses.mockResolvedValue(undefined);
    (getAccountGroupService as jest.Mock).mockReturnValue(accountGroupService);
    (getAccountService as jest.Mock).mockReturnValue(accountService);
    (getAuthService as jest.Mock).mockReturnValue(authService);
    (getVaultService as jest.Mock).mockReturnValue(vaultService);
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useRemoveAccountGroup deletes vault, disconnects sessions, and invalidates group cache', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    accountGroupService.getGroup.mockResolvedValue({
      id: 'group_1',
      vaultId: 'vault_1',
    });
    accountService.getAccountsByGroup.mockResolvedValue([
      { ...mockAccount, selected: false },
      { ...mockAccount, id: 'acc_2', address: '0xdef', selected: false },
    ]);

    const { result } = renderHook(() => useRemoveAccountGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('group_1');
    });

    expect(authService.getPassword).toHaveBeenCalledTimes(1);
    expect(vaultService.deleteVault).toHaveBeenCalledWith('vault_1');
    expect(mockDisconnectByAddresses).toHaveBeenCalledWith(['0xabc', '0xdef']);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountGroupRootKey() });
  });

  it('useRemoveAccountGroup keeps deletion successful when WalletConnect cleanup fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    accountGroupService.getGroup.mockResolvedValue({
      id: 'group_1',
      vaultId: 'vault_1',
    });
    accountService.getAccountsByGroup.mockResolvedValue([{ ...mockAccount, selected: false }]);
    mockDisconnectByAddresses.mockRejectedValue(new Error('disconnect failed'));

    const { result } = renderHook(() => useRemoveAccountGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('group_1');
    });

    await waitFor(() => {
      expect(vaultService.deleteVault).toHaveBeenCalledWith('vault_1');
    });
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });
    warnSpy.mockRestore();
  });

  it('useRemoveAccountGroup rejects deleting a group with a selected account', async () => {
    accountGroupService.getGroup.mockResolvedValue({
      id: 'group_1',
      vaultId: 'vault_1',
    });
    accountService.getAccountsByGroup.mockResolvedValue([mockAccount]);

    const { result } = renderHook(() => useRemoveAccountGroup(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync('group_1');
      }),
    ).rejects.toThrow('Selected account group cannot be removed.');

    expect(vaultService.deleteVault).not.toHaveBeenCalled();
    expect(mockDisconnectByAddresses).not.toHaveBeenCalled();
  });
});
