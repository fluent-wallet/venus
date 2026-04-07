import { type ISignatureRecord, SignatureFilterOption } from '@core/services/signing/types';
import { type InfiniteData, type UseInfiniteQueryResult, type UseQueryResult, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useCurrentAddress } from './account';
import { getSignatureRecordService } from './core';

export type SignatureRecordsQuery = UseQueryResult<ISignatureRecord[]>;
export type SignatureRecordsCountQuery = UseQueryResult<number>;
export type InfiniteSignatureRecordsQuery = UseInfiniteQueryResult<InfiniteData<ISignatureRecord[], number>>;

// Key helpers
export const getSignatureRootKey = () => ['signature'] as const;
export const getSignatureRecordsKey = (addressId: string, filter: SignatureFilterOption, limit?: number, offset?: number) =>
  ['signature', 'records', addressId, filter, limit ?? 'all', offset ?? 0] as const;
export const getSignatureRecordsCountKey = (addressId: string, filter: SignatureFilterOption) => ['signature', 'count', addressId, filter] as const;
export const getInfiniteSignatureRecordsKey = (addressId: string, filter: SignatureFilterOption, pageSize: number) =>
  ['signature', 'records', 'infinite', addressId, filter, pageSize] as const;

export async function fetchSignatureRecords(
  addressId: string,
  params: { current: number; pageSize: number; offset?: number; filter?: SignatureFilterOption },
): Promise<ISignatureRecord[]> {
  const current = Math.max(0, params.current);
  const pageSize = Math.max(0, params.pageSize);
  const offset = Math.max(0, params.offset ?? 0);

  return getSignatureRecordService().listRecords({
    addressId,
    filter: params.filter ?? SignatureFilterOption.All,
    limit: pageSize,
    offset: offset + current * pageSize,
  });
}

/**
 * Fetch signature records of a specific address.
 * @example
 * const { data: records } = useSignatureRecordsOfAddress(addressId, { filter: SignatureFilterOption.All, limit: 20, offset: 0 });
 */
export function useSignatureRecordsOfAddress(
  addressId: string,
  options: { filter?: SignatureFilterOption; limit?: number; offset?: number } = {},
): SignatureRecordsQuery {
  const service = getSignatureRecordService();
  const filter = options.filter ?? SignatureFilterOption.All;

  return useQuery({
    queryKey: getSignatureRecordsKey(addressId || 'none', filter, options.limit, options.offset),
    queryFn: () => service.listRecords({ addressId, filter, limit: options.limit, offset: options.offset }),
    enabled: !!addressId,
    initialData: [],
  });
}

/**
 * Fetch total count of signature records of a specific address.
 * @example
 * const { data: total } = useSignatureRecordsCountOfAddress(addressId, SignatureFilterOption.All);
 */
export function useSignatureRecordsCountOfAddress(addressId: string, filter: SignatureFilterOption = SignatureFilterOption.All): SignatureRecordsCountQuery {
  const service = getSignatureRecordService();

  return useQuery({
    queryKey: getSignatureRecordsCountKey(addressId || 'none', filter),
    queryFn: () => service.countRecords({ addressId, filter }),
    enabled: !!addressId,
    initialData: 0,
  });
}

/**
 * Fetch signature records of a specific address with incremental pagination.
 */
export function useInfiniteSignatureRecordsOfAddress(
  addressId: string,
  options: { filter?: SignatureFilterOption; pageSize?: number } = {},
): InfiniteSignatureRecordsQuery {
  const service = getSignatureRecordService();
  const queryClient = useQueryClient();
  const filter = options.filter ?? SignatureFilterOption.All;
  const pageSize = Math.max(1, options.pageSize ?? 20);
  const countQueryKey = getSignatureRecordsCountKey(addressId || 'none', filter);
  const snapshotScope = `${addressId || 'none'}:${filter}`;
  const countSnapshotRef = useRef<{
    scope: string;
    initialCount: number | null;
    latestCount: number | null;
  }>({
    scope: snapshotScope,
    initialCount: null,
    latestCount: null,
  });

  const countQuery = useQuery({
    queryKey: countQueryKey,
    queryFn: () => service.countRecords({ addressId, filter }),
    enabled: !!addressId,
  });

  if (countSnapshotRef.current.scope !== snapshotScope) {
    countSnapshotRef.current = {
      scope: snapshotScope,
      initialCount: null,
      latestCount: null,
    };
  }

  countSnapshotRef.current.latestCount = typeof countQuery.data === 'number' ? countQuery.data : null;
  if (countSnapshotRef.current.latestCount !== null && countSnapshotRef.current.initialCount === null) {
    countSnapshotRef.current.initialCount = countSnapshotRef.current.latestCount;
  }

  return useInfiniteQuery({
    queryKey: getInfiniteSignatureRecordsKey(addressId || 'none', filter, pageSize),
    queryFn: ({ pageParam }) => {
      const cachedCount = queryClient.getQueryData<number>(countQueryKey);
      const currentCount = typeof cachedCount === 'number' ? cachedCount : countSnapshotRef.current.latestCount;
      countSnapshotRef.current.latestCount = typeof currentCount === 'number' ? currentCount : null;
      if (countSnapshotRef.current.latestCount !== null && countSnapshotRef.current.initialCount === null) {
        countSnapshotRef.current.initialCount = countSnapshotRef.current.latestCount;
      }

      const snapshotCount = countSnapshotRef.current.initialCount;
      const offsetCompensation = typeof currentCount === 'number' && typeof snapshotCount === 'number' ? Math.max(0, currentCount - snapshotCount) : 0;

      return service.listRecords({
        addressId,
        filter,
        limit: pageSize,
        offset: offsetCompensation + pageParam * pageSize,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const snapshotCount = countSnapshotRef.current.initialCount;
      if (typeof snapshotCount === 'number') {
        return (lastPageParam + 1) * pageSize < snapshotCount ? lastPageParam + 1 : undefined;
      }

      if (lastPage.length < pageSize) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    enabled: !!addressId,
  });
}

/**
 * Fetch signature records of the current address (if any).
 * @example
 * const { data: records } = useSignatureRecordsOfCurrentAddress({ filter: SignatureFilterOption.All });
 */
export function useSignatureRecordsOfCurrentAddress(options: { filter?: SignatureFilterOption; limit?: number; offset?: number } = {}): SignatureRecordsQuery {
  const current = useCurrentAddress();
  const addressId = current.data?.id ?? '';
  return useSignatureRecordsOfAddress(addressId, options);
}

/**
 * Fetch signature records of the current address with incremental pagination.
 */
export function useInfiniteSignatureRecordsOfCurrentAddress(
  options: { filter?: SignatureFilterOption; pageSize?: number } = {},
): InfiniteSignatureRecordsQuery {
  const current = useCurrentAddress();
  const addressId = current.data?.id ?? '';
  return useInfiniteSignatureRecordsOfAddress(addressId, options);
}

/**
 * Fetch signature records count of the current address (if any).
 * @example
 * const { data: total } = useSignatureRecordsCountOfCurrentAddress(SignatureFilterOption.All);
 */
export function useSignatureRecordsCountOfCurrentAddress(filter: SignatureFilterOption = SignatureFilterOption.All): SignatureRecordsCountQuery {
  const current = useCurrentAddress();
  const addressId = current.data?.id ?? '';
  return useSignatureRecordsCountOfAddress(addressId, filter);
}
