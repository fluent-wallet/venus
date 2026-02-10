import { type ISignatureRecord, SignatureFilterOption } from '@core/services/signing/types';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useCurrentAddress } from './account';
import { getSignatureRecordService } from './core';

export type SignatureRecordsQuery = UseQueryResult<ISignatureRecord[]>;
export type SignatureRecordsCountQuery = UseQueryResult<number>;

// Key helpers
export const getSignatureRootKey = () => ['signature'] as const;
export const getSignatureRecordsKey = (addressId: string, filter: SignatureFilterOption, limit?: number, offset?: number) =>
  ['signature', 'records', addressId, filter, limit ?? 'all', offset ?? 0] as const;
export const getSignatureRecordsCountKey = (addressId: string, filter: SignatureFilterOption) => ['signature', 'count', addressId, filter] as const;

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
 * Fetch signature records count of the current address (if any).
 * @example
 * const { data: total } = useSignatureRecordsCountOfCurrentAddress(SignatureFilterOption.All);
 */
export function useSignatureRecordsCountOfCurrentAddress(filter: SignatureFilterOption = SignatureFilterOption.All): SignatureRecordsCountQuery {
  const current = useCurrentAddress();
  const addressId = current.data?.id ?? '';
  return useSignatureRecordsCountOfAddress(addressId, filter);
}
