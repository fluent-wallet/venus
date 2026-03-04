import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getAccountGroupService, type IAccountGroup } from './core';

export type AccountGroupsQuery = UseQueryResult<IAccountGroup[]>;
export type AccountGroupQuery = UseQueryResult<IAccountGroup | null>;

export const getAccountGroupRootKey = () => ['accountGroup'] as const;
export const getAccountGroupListKey = (includeHidden = false) => ['accountGroup', 'list', includeHidden] as const;
export const getAccountGroupKey = (groupId: string, includeHidden = false) => ['accountGroup', 'byId', groupId, includeHidden] as const;

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

export function useAccountGroupLastAccountIndex() {
  const service = getAccountGroupService();
  return useCallback(async (groupId: string) => service.getLastAccountIndex(groupId), [service]);
}
