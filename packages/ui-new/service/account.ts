import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getAccountGroupRootKey } from './accountGroupKeys';
import { getAccountGroupService, getAccountService, getAuthService, getVaultService, type IAccount } from './core';
import { getVaultRootKey } from './vaultKeys';
import { useDisconnectWalletConnectSessionsByAddresses } from './walletConnect';

export type AccountQuery = UseQueryResult<IAccount | null>;
export type AccountsQuery = UseQueryResult<IAccount[]>;

export interface ICurrentAddress {
  id: string;
  value: string;
}
export type CurrentAddressQuery = UseQueryResult<ICurrentAddress | null>;

export const getAccountRootKey = () => ['account'] as const;
export const getCurrentAccountKey = () => ['account', 'current'] as const;
export const getAccountListKey = (includeHidden = false) => ['account', 'list', includeHidden] as const;
export const getAccountGroupKey = (groupId: string, includeHidden = false) => ['account', 'group', groupId, includeHidden] as const;
export const getAccountByIdKey = (accountId: string) => ['account', 'byId', accountId] as const;

type RemoveAccountMutationResult = {
  disconnectAddresses: string[];
  shouldInvalidateVault: boolean;
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
    console.warn('[service/account] Failed to disconnect WalletConnect sessions after account removal.', error);
  }
}

function updateSelectedAccountSnapshot(data: IAccount | IAccount[] | null | undefined, accountId: string): IAccount | IAccount[] | null | undefined {
  if (Array.isArray(data)) {
    return data.map((account) => ({
      ...account,
      selected: account.id === accountId,
    }));
  }

  if (!data) {
    return data;
  }

  return {
    ...data,
    selected: data.id === accountId,
  };
}

/**
 * Fetch the currently selected account.
 * @example
 * const { data: currentAccount } = useCurrentAccount();
 */
export function useCurrentAccount(): AccountQuery {
  const service = getAccountService();
  return useQuery({
    queryKey: getCurrentAccountKey(),
    queryFn: () => service.getCurrentAccount(),
  });
}

/**
 * Fetch all accounts.
 * @example
 * const { data: accounts } = useAccounts(true);
 */
export function useAccounts(includeHidden = false): AccountsQuery {
  const service = getAccountService();
  return useQuery({
    queryKey: getAccountListKey(includeHidden),
    queryFn: () => service.listAccounts({ includeHidden }),
  });
}

/**
 * Fetch accounts of a specific group.
 * @example
 * const { data: groupAccounts } = useAccountsOfGroup(groupId);
 */
export function useAccountsOfGroup(accountGroupId: string, includeHidden = false): AccountsQuery {
  const service = getAccountService();
  return useQuery({
    queryKey: getAccountGroupKey(accountGroupId, includeHidden),
    queryFn: () => service.getAccountsByGroup(accountGroupId, { includeHidden }),
    enabled: !!accountGroupId,
  });
}

/**
 * Fetch account by id.
 */
export function useAccountById(accountId: string | null | undefined): AccountQuery {
  const service = getAccountService();
  return useQuery({
    queryKey: getAccountByIdKey(accountId ?? ''),
    queryFn: () => (accountId ? service.getAccountById(accountId) : Promise.resolve(null)),
    enabled: !!accountId,
  });
}

/**
 * Derive current address id/value from the current account.
 * @example
 * const { data: currentAddress } = useCurrentAddress();
 */
export function useCurrentAddress(): CurrentAddressQuery {
  const service = getAccountService();
  return useQuery({
    queryKey: getCurrentAccountKey(),
    queryFn: () => service.getCurrentAccount(),
    select: (account) => (account?.currentAddressId ? { id: account.currentAddressId, value: account.address } : null),
  });
}

/**
 * Switch the selected account and refresh account queries.
 * @example
 * const switchAccount = useSwitchAccount();
 * await switchAccount('acc_1');
 */
export function useSwitchAccount() {
  const service = getAccountService();
  const queryClient = useQueryClient();
  return useCallback(
    async (accountId: string) => {
      const targetAccount = await service.getAccountById(accountId);

      await service.switchAccount(accountId);

      if (targetAccount) {
        const selectedAccount = { ...targetAccount, selected: true };
        queryClient.setQueryData(getCurrentAccountKey(), selectedAccount);
        queryClient.setQueriesData<IAccount[] | null>(
          { queryKey: getAccountListKey(false) },
          (data) => updateSelectedAccountSnapshot(data, accountId) as IAccount[] | null,
        );
        queryClient.setQueriesData<IAccount[] | null>(
          { queryKey: getAccountListKey(true) },
          (data) => updateSelectedAccountSnapshot(data, accountId) as IAccount[] | null,
        );
        queryClient.setQueriesData<IAccount[] | null>(
          { queryKey: ['account', 'group'] },
          (data) => updateSelectedAccountSnapshot(data, accountId) as IAccount[] | null,
        );
        queryClient.setQueriesData<IAccount | null>(
          { queryKey: ['account', 'byId'] },
          (data) => updateSelectedAccountSnapshot(data, accountId) as IAccount | null,
        );
      }

      await queryClient.invalidateQueries({ queryKey: getAccountRootKey(), refetchType: 'inactive' });
    },
    [service, queryClient],
  );
}

/**
 * Update account nickname and refresh account queries.
 * @example
 * const updateNickname = useUpdateAccountNickname();
 * await updateNickname('acc_1', 'Main');
 */
export function useUpdateAccountNickname() {
  const service = getAccountService();
  const queryClient = useQueryClient();
  return useCallback(
    async (accountId: string, nickname: string) => {
      await service.updateAccountNickName(accountId, nickname);
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
    },
    [service, queryClient],
  );
}

/**
 * Remove an account through the service layer and refresh dependent caches.
 * Grouped vault accounts are hidden because HD/BSIM groups manage a visible account set by index.
 * Standalone vault accounts remove the whole backing vault.
 */
export function useRemoveAccount() {
  const accountService = getAccountService();
  const accountGroupService = getAccountGroupService();
  const vaultService = getVaultService();
  const disconnectByAddresses = useDisconnectWalletConnectSessionsByAddresses();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string): Promise<RemoveAccountMutationResult> => {
      const account = await accountService.getAccountById(accountId);
      if (!account) {
        throw new Error(`Account ${accountId} not found.`);
      }
      if (account.selected) {
        throw new Error('Selected account cannot be removed.');
      }

      const accountGroup = await accountGroupService.getGroup(account.accountGroupId, { includeHidden: true });
      if (!accountGroup) {
        throw new Error(`AccountGroup ${account.accountGroupId} not found.`);
      }

      if (accountGroup.isGroup) {
        await accountService.setAccountHidden(account.id, true);
        return {
          disconnectAddresses: getUniqueAddresses([account.address]),
          shouldInvalidateVault: false,
        };
      }

      await getAuthService().getPassword();
      await vaultService.deleteVault(accountGroup.vaultId);
      return {
        disconnectAddresses: getUniqueAddresses([account.address]),
        shouldInvalidateVault: true,
      };
    },
    onSuccess: async (result) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: getAccountRootKey() }),
        queryClient.invalidateQueries({ queryKey: getAccountGroupRootKey() }),
      ];

      if (result.shouldInvalidateVault) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: getVaultRootKey() }));
      }

      await Promise.all(invalidations);
      await tryDisconnectSessions(disconnectByAddresses, result.disconnectAddresses);
    },
  });
}

/**
 * Apply visible account indexes for a group (create missing accounts + hide/show existing ones).
 */
export function useApplyGroupVisibleIndexes() {
  const service = getAccountService();
  const queryClient = useQueryClient();
  return useCallback(
    async (params: { accountGroupId: string; visibleIndexes: number[]; mnemonic?: string }) => {
      const result = await service.applyGroupVisibleIndexes(params);
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAccountGroupRootKey() });
      return result;
    },
    [service, queryClient],
  );
}
