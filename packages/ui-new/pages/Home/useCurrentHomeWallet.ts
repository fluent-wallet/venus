import { useCurrentAccount, useCurrentAddress } from '@service/account';
import { VaultSourceType, VaultType } from '@service/core';
import { useVaults } from '@service/vault';
import { useMemo } from 'react';

function shouldShowBackupBanner(vault?: { type: VaultType; source: VaultSourceType; isBackup: boolean } | null) {
  if (!vault) return false;

  const isBackupRequiredVault = vault.type === VaultType.HierarchicalDeterministic || vault.type === VaultType.BSIM;
  const isCreatedByUser = vault.source !== VaultSourceType.IMPORT_BY_USER;

  return isBackupRequiredVault && isCreatedByUser && !vault.isBackup;
}

export function useCurrentHomeWallet() {
  const { data: currentAccount } = useCurrentAccount();
  const { data: currentAddress } = useCurrentAddress();
  const { data: vaults = [] } = useVaults();

  const currentAccountGroupId = currentAccount?.accountGroupId ?? null;

  const currentVault = useMemo(() => {
    if (!currentAccountGroupId) return null;
    return vaults.find((vault) => vault.accountGroupId === currentAccountGroupId) ?? null;
  }, [currentAccountGroupId, vaults]);

  const shouldShowNotBackup = useMemo(() => shouldShowBackupBanner(currentVault), [currentVault]);

  return {
    currentAccount,
    currentAddress,
    currentAddressValue: currentAddress?.value ?? null,
    currentAccountGroupId,
    currentVault,
    shouldShowNotBackup,
  };
}
