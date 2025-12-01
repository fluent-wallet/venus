import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { getAccountRootKey } from './account';
import { getVaultService } from './core';
import { mockVault } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
import {
  getVaultListKey,
  getVaultRootKey,
  useCreateBSIMVault,
  useCreateHDVault,
  useCreatePrivateKeyVault,
  useCreatePublicAddressVault,
  useDeleteVault,
  useExportMnemonic,
  useExportPrivateKey,
  useVaults,
} from './vault';

jest.mock('./core', () => ({ getVaultService: jest.fn() }));
jest.mock('./account', () => ({ getAccountRootKey: jest.fn(() => ['account'] as const) }));

type VaultServiceMock = {
  listVaults: jest.Mock;
  createHDVault: jest.Mock;
  createPrivateKeyVault: jest.Mock;
  createBSIMVault: jest.Mock;
  createPublicAddressVault: jest.Mock;
  deleteVault: jest.Mock;
  getMnemonic: jest.Mock;
  getPrivateKey: jest.Mock;
};

describe('vault service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: VaultServiceMock;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      listVaults: jest.fn().mockResolvedValue([mockVault]),
      createHDVault: jest.fn().mockResolvedValue(mockVault),
      createPrivateKeyVault: jest.fn().mockResolvedValue(mockVault),
      createBSIMVault: jest.fn().mockResolvedValue(mockVault),
      createPublicAddressVault: jest.fn().mockResolvedValue(mockVault),
      deleteVault: jest.fn().mockResolvedValue(undefined),
      getMnemonic: jest.fn().mockResolvedValue('mnemonic'),
      getPrivateKey: jest.fn().mockResolvedValue('0xkey'),
    };
    (getVaultService as jest.Mock).mockReturnValue(service);
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useVaults caches list under getVaultListKey', async () => {
    const { result } = renderHook(() => useVaults(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockVault]);
    expect(queryClient.getQueryData(getVaultListKey())).toEqual([mockVault]);
  });

  it.each([
    ['useCreateHDVault', useCreateHDVault, () => [{ password: 'p' }]],
    ['useCreatePrivateKeyVault', useCreatePrivateKeyVault, () => [{ privateKey: '0x1', password: 'p' }]],
    ['useCreateBSIMVault', useCreateBSIMVault, () => [{ accounts: [{ index: 0, hexAddress: '0xabc' }] }]],
    ['useCreatePublicAddressVault', useCreatePublicAddressVault, () => [{ hexAddress: '0xabc' }]],
    ['useDeleteVault', useDeleteVault, () => ['vault_1']],
  ])('%s invalidates vault + account caches', async (_label, hookFactory, argsFactory) => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => hookFactory(), { wrapper });

    await act(async () => {
      const args = argsFactory();
      await (result.current as (...params: unknown[]) => Promise<unknown>)(...(args as unknown[]));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getVaultRootKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountRootKey() });
  });

  it('useExportMnemonic forwards service result', async () => {
    const { result } = renderHook(() => useExportMnemonic(), { wrapper });

    const mnemonic = await result.current('vault_1', 'pwd');

    expect(service.getMnemonic).toHaveBeenCalledWith('vault_1', 'pwd');
    expect(mnemonic).toBe('mnemonic');
  });

  it('useExportPrivateKey forwards service result', async () => {
    const { result } = renderHook(() => useExportPrivateKey(), { wrapper });

    const pk = await result.current('vault_1', 'addr_1', 'pwd');

    expect(service.getPrivateKey).toHaveBeenCalledWith('vault_1', 'addr_1', 'pwd');
    expect(pk).toBe('0xkey');
  });

  describe('error handling', () => {
    it('useVaults handles service errors', async () => {
      const error = new Error('Database error');
      service.listVaults.mockRejectedValue(error);

      const { result } = renderHook(() => useVaults(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(error);
    });

    it('useCreateHDVault propagates errors', async () => {
      const error = new Error('Invalid password');
      service.createHDVault.mockRejectedValue(error);
      const { result } = renderHook(() => useCreateHDVault(), { wrapper });

      await expect(
        act(async () => {
          await result.current({ password: 'p' });
        }),
      ).rejects.toThrow('Invalid password');
    });

    it('useDeleteVault propagates errors', async () => {
      const error = new Error('Vault not found');
      service.deleteVault.mockRejectedValue(error);
      const { result } = renderHook(() => useDeleteVault(), { wrapper });

      await expect(
        act(async () => {
          await result.current('vault_1');
        }),
      ).rejects.toThrow('Vault not found');
    });

    it('useExportMnemonic propagates errors', async () => {
      const error = new Error('Wrong password');
      service.getMnemonic.mockRejectedValue(error);
      const { result } = renderHook(() => useExportMnemonic(), { wrapper });

      await expect(result.current('vault_1', 'wrong-pwd')).rejects.toThrow('Wrong password');
    });

    it('useExportPrivateKey propagates errors', async () => {
      const error = new Error('Address not found');
      service.getPrivateKey.mockRejectedValue(error);
      const { result } = renderHook(() => useExportPrivateKey(), { wrapper });

      await expect(result.current('vault_1', 'addr_invalid', 'pwd')).rejects.toThrow('Address not found');
    });
  });
});
