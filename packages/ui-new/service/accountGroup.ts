import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getAccountRootKey } from './account';
import { getAccountGroupKey, getAccountGroupListKey, getAccountGroupRootKey } from './accountGroupKeys';
import { getAccountGroupService, getAccountService, getAuthService, getVaultService, type IAccountGroup } from './core';
import { getVaultRootKey } from './vaultKeys';
import { useDisconnectWalletConnectSessionsByAddresses } from './walletConnect';

export type AccountGroupsQuery = UseQueryResult<IAccountGroup[]>;
export type AccountGroupQuery = UseQueryResult<IAccountGroup | null>;
export { getAccountGroupKey, getAccountGroupListKey, getAccountGroupRootKey } from './accountGroupKeys';

type RemoveAccountGroupMutationResult = {
  disconnectAddresses: string[];
};

function getUniqueAddresses(addresses: Array<string | null | undefined>): string[] {
  return Array.from(new Set(addresses.filter((address): address is string => typeof address === 'string' && address.length > 0)));
}

async function tryDisconnectSessions(disconnectByAddresses: (addresses: string[]) => Promise<unknown>, addresses: string[]): Promise<void> {
  if (!addresses.length) {
    return;
  }

  try {
    await disconnectByAddresses(addresses);
  } catch (error) {
    console.warn('[service/accountGroup] Failed to disconnect WalletConnect sessions after group removal.', error);
  }
}

export function useAccountGroups(includeHidden = false): AccountGroupsQuery {
  const service = getAccountGroupService();
  return useQuery({
    queryKey: getAccountGroupListKey(includeHidden),
    queryFn: () => service.listGroups({ includeHidden }),
  });
}

export function useAccountGroup(groupId: string | null | undefined, includeHidden = false): AccountGroupQuery {
  const service = getAccountGroupService();
  return useQuery({
    queryKey: getAccountGroupKey(groupId ?? '', includeHidden),
    queryFn: () => (groupId ? service.getGroup(groupId, { includeHidden }) : Promise.resolve(null)),
    enabled: !!groupId,
  });
}

export function useUpdateAccountGroupNickname() {
  const service = getAccountGroupService();
  const queryClient = useQueryClient();

  return useCallback(
    async (groupId: string, nickname: string) => {
      await service.updateGroupNickname(groupId, nickname);
      await queryClient.invalidateQueries({ queryKey: getAccountGroupRootKey() });
    },
    [queryClient, service],
  );
}

export function useRemoveAccountGroup() {
  const accountService = getAccountService();
  const accountGroupService = getAccountGroupService();
  const vaultService = getVaultService();
  const disconnectByAddresses = useDisconnectWalletConnectSessionsByAddresses();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string): Promise<RemoveAccountGroupMutationResult> => {
      const group = await accountGroupService.getGroup(groupId, { includeHidden: true });
      if (!group) {
        throw new Error(`AccountGroup ${groupId} not found.`);
      }

      const accounts = await accountService.getAccountsByGroup(groupId, { includeHidden: true });
      if (accounts.some((account) => account.selected)) {
        throw new Error('Selected account group cannot be removed.');
      }

      await getAuthService().getPassword();
      await vaultService.deleteVault(group.vaultId);
      return {
        disconnectAddresses: getUniqueAddresses(accounts.map((account) => account.address)),
      };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getVaultRootKey() }),
        queryClient.invalidateQueries({ queryKey: getAccountRootKey() }),
        queryClient.invalidateQueries({ queryKey: getAccountGroupRootKey() }),
      ]);

      await tryDisconnectSessions(disconnectByAddresses, result.disconnectAddresses);
    },
  });
}

export function useAccountGroupLastAccountIndex() {
  const service = getAccountGroupService();
  return useCallback(async (groupId: string) => service.getLastAccountIndex(groupId), [service]);
}
