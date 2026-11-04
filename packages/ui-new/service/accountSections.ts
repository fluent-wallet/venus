import { useMemo } from 'react';
import { useAccounts, useCurrentAccount } from './account';
import { useAccountGroups } from './accountGroup';
import { type IAccount, type IAccountGroup, VaultType } from './core';

export type AccountSection = {
  key: string;
  group: IAccountGroup;
  data: IAccount[];
};

export function buildAccountSections(accounts: readonly IAccount[], groups: readonly IAccountGroup[]): AccountSection[] {
  const accountsByGroup = new Map<string, IAccount[]>();
  for (const account of accounts) {
    if (account.hidden) continue;
    const groupAccounts = accountsByGroup.get(account.accountGroupId);
    if (groupAccounts) groupAccounts.push(account);
    else accountsByGroup.set(account.accountGroupId, [account]);
  }

  const sections: AccountSection[] = [];
  for (const group of groups) {
    const data = accountsByGroup.get(group.id);
    if (!data?.length) continue;
    sections.push({ key: group.id, group, data: data.sort((a, b) => a.index - b.index) });
  }

  return sections.sort((a, b) => Number(b.group.vaultType === VaultType.BSIM) - Number(a.group.vaultType === VaultType.BSIM));
}

export function useAccountSections() {
  const accounts = useAccounts(false);
  const groups = useAccountGroups(true);
  const { data: currentAccount } = useCurrentAccount();
  const sections = useMemo(() => buildAccountSections(accounts.data ?? [], groups.data ?? []), [accounts.data, groups.data]);
  return { sections, currentAccountId: currentAccount?.id };
}
