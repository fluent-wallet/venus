import type { LegacyLikeGasEstimate, SendERC20Input, SendTransactionInput } from '@core/services';
import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useCurrentAddress } from './account';
import { getAssetRootKey, getAssetsByAddressKey } from './asset';
import { getTransactionService, type ITransaction, type RecentlyAddress } from './core';

export type TransactionsQuery = UseQueryResult<ITransaction[]>;
export type RecentlyAddressesQuery = UseQueryResult<RecentlyAddress[]>;

export type Level = 'low' | 'medium' | 'high';

export const getTransactionRootKey = () => ['tx'] as const;
export const getTransactionsByAddressKey = (addressId: string, status: string, limit?: number) =>
  ['tx', 'byAddress', addressId, status, limit ?? 'all'] as const;
export const getRecentlyAddressesKey = (addressId: string) => ['tx', 'recently', addressId] as const;

export async function isPendingTxsFull(addressId: string): Promise<boolean> {
  if (!addressId) return false;
  return getTransactionService().isPendingTxsFull({ addressId });
}

export function usePollingGasEstimateAndNonce(
  tx: { from?: string; to?: string; value?: string; data?: string } | null,
  withNonce = true,
  addressIdOverride?: string,
): LegacyLikeGasEstimate | null {
  const service = getTransactionService();
  const currentAddress = useCurrentAddress();
  const addressId = addressIdOverride ?? currentAddress.data?.id ?? '';

  const enabled = !!addressId && !!tx;

  const estimate = useQuery({
    queryKey: [
      'gasEstimate',
      addressId || 'none',
      withNonce ? 'withNonce' : 'noNonce',
      tx ? (tx.from ?? '') : '__null__',
      tx ? (tx.to ?? '') : '__null__',
      tx ? (tx.value ?? '') : '__null__',
      tx ? (tx.data ?? '') : '__null__',
    ],
    queryFn: () => service.estimateLegacyGasForUi({ addressId, tx: tx!, withNonce }),
    enabled,
    refetchInterval: 15_000,
    retry: 0,
  });

  return enabled ? (estimate.data ?? null) : null;
}

/**
 * Fetch transactions of a specific address.
 * When addressId is empty, this query stays disabled.
 */
export function useTransactionsOfAddress(addressId: string, options: { status?: 'pending' | 'finished' | 'all'; limit?: number } = {}): TransactionsQuery {
  const service = getTransactionService();
  const status = options.status ?? 'all';

  return useQuery({
    queryKey: getTransactionsByAddressKey(addressId || 'none', status, options.limit),
    queryFn: () => service.listTransactions({ addressId, status, limit: options.limit }),
    enabled: !!addressId,
    initialData: [],
  });
}

/**
 * Fetch transactions of the current address (if any).
 */
export function useTransactionsOfCurrentAddress(options: { status?: 'pending' | 'finished' | 'all'; limit?: number } = {}): TransactionsQuery {
  const currentAddress = useCurrentAddress();
  const addressId = currentAddress.data?.id ?? '';
  return useTransactionsOfAddress(addressId, options);
}

/**
 * Fetch only pending transactions.
 */
export function useUnfinishedTxsOfAddress(addressId: string): TransactionsQuery {
  return useTransactionsOfAddress(addressId, { status: 'pending' });
}

/**
 * Fetch only finished transactions.
 */
export function useFinishedTxsOfAddress(addressId: string): TransactionsQuery {
  return useTransactionsOfAddress(addressId, { status: 'finished' });
}

/**
 * Fetch recently interacted addresses of a given address.
 * Result includes direction and local-account flag.
 */
export function useRecentlyAddressesOfAddress(addressId: string, limit = 20): RecentlyAddressesQuery {
  const service = getTransactionService();
  return useQuery({
    queryKey: getRecentlyAddressesKey(addressId || 'none'),
    queryFn: () => service.getRecentlyAddresses(addressId, limit),
    enabled: !!addressId,
    initialData: [],
  });
}

/**
 * Fetch recently interacted addresses of the current address.
 */
export function useRecentlyAddressesOfCurrentAddress(limit = 20): RecentlyAddressesQuery {
  const currentAddress = useCurrentAddress();
  const addressId = currentAddress.data?.id ?? '';
  return useRecentlyAddressesOfAddress(addressId, limit);
}

/**
 * Send a native transaction and refresh related caches.
 */
export function useSendNative() {
  const service = getTransactionService();
  const queryClient = useQueryClient();

  return useCallback(
    async (input: SendTransactionInput) => {
      const tx = await service.sendNative(input);
      await queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAssetsByAddressKey(input.addressId) });
      await queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
      return tx;
    },
    [service, queryClient],
  );
}

/**
 * Send an ERC20 transaction and refresh related caches.
 */
export function useSendERC20() {
  const service = getTransactionService();
  const queryClient = useQueryClient();

  return useCallback(
    async (input: SendERC20Input) => {
      const tx = await service.sendERC20(input);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getTransactionRootKey() }),
        queryClient.invalidateQueries({ queryKey: getAssetsByAddressKey(input.addressId) }),
        queryClient.invalidateQueries({ queryKey: getAssetRootKey() }),
      ]);
      return tx;
    },
    [service, queryClient],
  );
}
