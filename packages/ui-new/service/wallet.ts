import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCurrentAccount } from './account';
import { getVaultService } from './core';
import { getVaultRootKey } from './vault';

export const getHasVaultKey = () => ['vault', 'hasAny'] as const;

/**
 * Check if any vault exists.
 * @example
 * const { data: hasVault } = useHasVault();
 */
export function useHasVault(): UseQueryResult<boolean> {
  const service = getVaultService();
  return useQuery({
    queryKey: getHasVaultKey(),
    queryFn: () => service.hasAnyVault(),
  });
}

/**
 * Composite ready state based on vault presence and current account.
 * @example
 * const { data: ready } = useWalletReady();
 */
export function useWalletReady(): { data: boolean; isLoading: boolean; error: Error | null } {
  const hasVaultQuery = useHasVault();
  const accountQuery = useCurrentAccount();

  const isLoading = hasVaultQuery.isLoading || accountQuery.isLoading;
  const error = (hasVaultQuery.error as Error | null) || (accountQuery.error as Error | null);

  const data = useMemo(() => {
    if (isLoading || error) return false;
    if (!hasVaultQuery.data) return true; // onboarding ready when no vaults
    return accountQuery.data?.currentAddressId != null;
  }, [hasVaultQuery.data, accountQuery.data, isLoading, error]);

  return { data, isLoading, error };
}
