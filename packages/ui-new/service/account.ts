import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getAccountService, type IAccount } from './core';

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
 * Derive current address id/value from the current account.
 * @example
 * const { data: currentAddress } = useCurrentAddress();
 */
export function useCurrentAddress(): CurrentAddressQuery {
  const service = getAccountService();
  return useQuery({
    queryKey: getCurrentAccountKey(),
    queryFn: () => service.getCurrentAccount(),
    select: (account) => (account && account.currentAddressId ? { id: account.currentAddressId, value: account.address } : null),
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
      await service.switchAccount(accountId);
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
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
 * Toggle account visibility and refresh account queries.
 * @example
 * const setHidden = useSetAccountHidden();
 * await setHidden('acc_1', true);
 */

export function useSetAccountHidden() {
  const service = getAccountService();
  const queryClient = useQueryClient();
  return useCallback(
    async (accountId: string, hidden: boolean) => {
      await service.setAccountHidden(accountId, hidden);
      await queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
    },
    [service, queryClient],
  );
}
