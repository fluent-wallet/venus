import type { CreateBSIMVaultInput, CreateHDVaultInput, CreatePrivateKeyVaultInput, CreatePublicAddressVaultInput } from '@core/services/vault/types';
import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getAccountRootKey } from './account';
import { getVaultService, type IVault } from './core';

export type VaultsQuery = UseQueryResult<IVault[]>;

export const getVaultRootKey = () => ['vault'] as const;
export const getVaultListKey = () => ['vault', 'list'] as const;

/**
 * Fetch all vaults.
 * @example
 * const { data: vaults } = useVaults();
 */
export function useVaults(): VaultsQuery {
  const service = getVaultService();
  return useQuery({
    queryKey: getVaultListKey(),
    queryFn: () => service.listVaults(),
  });
}

/**
 * Create an HD vault then refresh vault/account caches.
 * @example
 * const createHDVault = useCreateHDVault();
 * await createHDVault({ password: 'p@ss' });
 */
export function useCreateHDVault() {
  const service = getVaultService();
  const queryClient = useQueryClient();
  return useCallback(
    async (input: CreateHDVaultInput) => {
      const vault = await service.createHDVault(input);
      await queryClient.invalidateQueries({ queryKey: getVaultRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
      return vault;
    },
    [service, queryClient],
  );
}

/**
 * Create a PrivateKey vault then refresh vault/account caches.
 * @example
 * const createPkVault = useCreatePrivateKeyVault();
 * const vault = await createPkVault({ privateKey: '0x...', password: 'p@ss' });
 */
export function useCreatePrivateKeyVault() {
  const service = getVaultService();
  const queryClient = useQueryClient();
  return useCallback(
    async (input: CreatePrivateKeyVaultInput) => {
      const vault = await service.createPrivateKeyVault(input);
      await queryClient.invalidateQueries({ queryKey: getVaultRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
      return vault;
    },
    [service, queryClient],
  );
}

/**
 * Create a BSIM vault then refresh vault/account caches.
 * @example
 * const createBSIMVault = useCreateBSIMVault();
 * const vault = await createBSIMVault({ accounts: [{ index: 0, hexAddress: '0xabc...' }] });
 */
export function useCreateBSIMVault() {
  const service = getVaultService();
  const queryClient = useQueryClient();
  return useCallback(
    async (input: CreateBSIMVaultInput) => {
      const vault = await service.createBSIMVault(input);
      await queryClient.invalidateQueries({ queryKey: getVaultRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
      return vault;
    },
    [service, queryClient],
  );
}

/**
 * Create a PublicAddress vault then refresh vault/account caches.
 * @example
 * const createPubVault = useCreatePublicAddressVault();
 * const vault = await createPubVault({ hexAddress: '0xabc...' });
 */
export function useCreatePublicAddressVault() {
  const service = getVaultService();
  const queryClient = useQueryClient();
  return useCallback(
    async (input: CreatePublicAddressVaultInput) => {
      const vault = await service.createPublicAddressVault(input);
      await queryClient.invalidateQueries({ queryKey: getVaultRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
      return vault;
    },
    [service, queryClient],
  );
}

/**
 * Delete a vault and refresh vault/account caches.
 * @example
 * const deleteVault = useDeleteVault();
 * await deleteVault('vault_1');
 */
export function useDeleteVault() {
  const service = getVaultService();
  const queryClient = useQueryClient();
  return useCallback(
    async (vaultId: string) => {
      await service.deleteVault(vaultId);
      await queryClient.invalidateQueries({ queryKey: getVaultRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
    },
    [service, queryClient],
  );
}

/**
 * Export mnemonic for an HD vault.
 * @example
 * const exportMnemonic = useExportMnemonic();
 * const phrase = await exportMnemonic('vault_1');
 */
export function useExportMnemonic() {
  const service = getVaultService();
  return useCallback(async (vaultId: string, password?: string) => service.getMnemonic(vaultId, password), [service]);
}

/**
 * Export private key for an address under a vault.
 * @example
 * const exportPk = useExportPrivateKey();
 * const pk = await exportPk('vault_1', 'addr_1');
 */
export function useExportPrivateKey() {
  const service = getVaultService();
  return useCallback(async (vaultId: string, addressId: string, password?: string) => service.getPrivateKey(vaultId, addressId, password), [service]);
}
