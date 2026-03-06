import type { GasPricingEstimate, SendERC20Input, SendTransactionInput, SpeedUpTxContext, SpeedUpTxInput } from '@core/services';
import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useCurrentAddress } from './account';
import { getAssetRootKey, getAssetsByAddressKey, getAssetsByAddressRootKey } from './asset';
import { getTransactionService, type IActivityTransaction, type ITransaction, type ITransactionDetail, type RecentlyAddress } from './core';

export type TransactionsQuery = UseQueryResult<ITransaction[]>;
export type ActivityTransactionsQuery = UseQueryResult<IActivityTransaction[]>;
export type RecentlyAddressesQuery = UseQueryResult<RecentlyAddress[]>;
export type SpeedUpContextQuery = UseQueryResult<SpeedUpTxContext | null>;
export type TransactionDetailQuery = UseQueryResult<ITransactionDetail | null>;

export type Level = 'low' | 'medium' | 'high';
export interface ITransactionGasEstimate {
  gasLimit: string;
  gasPrice: string;
  storageLimit?: string;
  nonce: number;
  estimate?: Record<Level, { suggestedGasPrice: string; gasCost: string }>;
  estimateOf1559?: Record<Level, { suggestedMaxFeePerGas: string; suggestedMaxPriorityFeePerGas: string; gasCost: string }>;
}

export const getTransactionRootKey = () => ['tx'] as const;
export const getGasEstimateRootKey = () => ['gasEstimate'] as const;
export const getTransactionsByAddressKey = (addressId: string, status: string, limit?: number) =>
  ['tx', 'byAddress', addressId, status, limit ?? 'all'] as const;
export const getActivityTransactionsByAddressKey = (addressId: string, status: string, limit?: number) =>
  ['tx', 'activity', 'byAddress', addressId, status, limit ?? 'all'] as const;
export const getTransactionDetailKey = (txId: string) => ['tx', 'detail', txId] as const;
export const getRecentlyAddressesKey = (addressId: string) => ['tx', 'recently', addressId] as const;
export const getSpeedUpContextKey = (txId: string) => ['tx', 'speedUpContext', txId] as const;
export const getGasEstimateKey = (params: {
  addressId: string;
  withNonce: boolean;
  tx: { from?: string; to?: string; value?: string; data?: string } | null;
}) =>
  [
    ...getGasEstimateRootKey(),
    params.addressId || 'none',
    params.withNonce ? 'withNonce' : 'noNonce',
    params.tx ? (params.tx.from ?? '') : '__null__',
    params.tx ? (params.tx.to ?? '') : '__null__',
    params.tx ? (params.tx.value ?? '') : '__null__',
    params.tx ? (params.tx.data ?? '') : '__null__',
  ] as const;

export async function isPendingTxsFull(addressId: string): Promise<boolean> {
  if (!addressId) return false;
  return getTransactionService().isPendingTxsFull({ addressId });
}

function toTransactionGasEstimate(estimate: GasPricingEstimate): ITransactionGasEstimate {
  const base = {
    gasLimit: estimate.gasLimit,
    gasPrice: estimate.gasPrice,
    storageLimit: estimate.storageLimit,
    nonce: estimate.nonce,
  };

  if (estimate.pricing.kind === 'legacy') {
    return {
      ...base,
      estimate: {
        low: {
          suggestedGasPrice: estimate.pricing.levels.low.gasPrice,
          gasCost: estimate.pricing.levels.low.gasCost,
        },
        medium: {
          suggestedGasPrice: estimate.pricing.levels.medium.gasPrice,
          gasCost: estimate.pricing.levels.medium.gasCost,
        },
        high: {
          suggestedGasPrice: estimate.pricing.levels.high.gasPrice,
          gasCost: estimate.pricing.levels.high.gasCost,
        },
      },
    };
  }

  return {
    ...base,
    estimateOf1559: {
      low: {
        suggestedMaxFeePerGas: estimate.pricing.levels.low.maxFeePerGas,
        suggestedMaxPriorityFeePerGas: estimate.pricing.levels.low.maxPriorityFeePerGas,
        gasCost: estimate.pricing.levels.low.gasCost,
      },
      medium: {
        suggestedMaxFeePerGas: estimate.pricing.levels.medium.maxFeePerGas,
        suggestedMaxPriorityFeePerGas: estimate.pricing.levels.medium.maxPriorityFeePerGas,
        gasCost: estimate.pricing.levels.medium.gasCost,
      },
      high: {
        suggestedMaxFeePerGas: estimate.pricing.levels.high.maxFeePerGas,
        suggestedMaxPriorityFeePerGas: estimate.pricing.levels.high.maxPriorityFeePerGas,
        gasCost: estimate.pricing.levels.high.gasCost,
      },
    },
  };
}

export function usePollingGasEstimateAndNonce(
  tx: { from?: string; to?: string; value?: string; data?: string } | null,
  withNonce = true,
  addressIdOverride?: string,
): ITransactionGasEstimate | null {
  const service = getTransactionService();
  const currentAddress = useCurrentAddress();
  const addressId = addressIdOverride ?? currentAddress.data?.id ?? '';

  const enabled = !!addressId && !!tx;

  const estimate = useQuery({
    queryKey: getGasEstimateKey({ addressId, withNonce, tx }),
    queryFn: () => {
      if (!tx) {
        throw new Error('Missing tx for gas estimate.');
      }
      return service.estimateGasPricing({ addressId, tx, withNonce }).then(toTransactionGasEstimate);
    },
    enabled,
    refetchInterval: 15_000,
    retry: 0,
  });

  return enabled ? (estimate.data ?? null) : null;
}

export function useSpeedUpTxContext(txId: string): SpeedUpContextQuery {
  const service = getTransactionService();
  return useQuery({
    queryKey: getSpeedUpContextKey(txId || 'none'),
    queryFn: () => (txId ? service.getSpeedUpTxContext(txId) : null),
    enabled: !!txId,
  });
}

export function useSpeedUpTx() {
  const service = getTransactionService();
  const queryClient = useQueryClient();

  return useCallback(
    async (input: SpeedUpTxInput) => {
      const tx = await service.speedUpTx(input);
      await queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
      // Keep behavior close to sendNative/sendERC20: refresh all address-scoped asset queries.
      await queryClient.invalidateQueries({ queryKey: getAssetsByAddressRootKey() });
      return tx;
    },
    [service, queryClient],
  );
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
 * Fetch activity transactions of a specific address.
 */
export function useActivityTransactionsOfAddress(
  addressId: string,
  options: { status?: 'pending' | 'finished' | 'all'; limit?: number } = {},
): ActivityTransactionsQuery {
  const service = getTransactionService();
  const status = options.status ?? 'all';

  return useQuery({
    queryKey: getActivityTransactionsByAddressKey(addressId || 'none', status, options.limit),
    queryFn: () => service.listActivityTransactions({ addressId, status, limit: options.limit }),
    enabled: !!addressId,
    initialData: [],
  });
}

/**
 * Fetch activity transactions of the current address (if any).
 */
export function useActivityTransactionsOfCurrentAddress(options: { status?: 'pending' | 'finished' | 'all'; limit?: number } = {}): ActivityTransactionsQuery {
  const currentAddress = useCurrentAddress();
  const addressId = currentAddress.data?.id ?? '';
  return useActivityTransactionsOfAddress(addressId, options);
}

/**
 * Fetch a transaction detail snapshot (or null if not found).
 */
export function useTransactionDetail(txId: string): TransactionDetailQuery {
  const service = getTransactionService();
  return useQuery({
    queryKey: getTransactionDetailKey(txId || 'none'),
    queryFn: () => (txId ? service.getTransactionDetail(txId) : null),
    enabled: !!txId,
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
