import type { NetworkEndpointEntry } from '@core/services/network/types';
import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getNetworkService, type INetwork } from './core';

export type NetworkQuery = UseQueryResult<INetwork | null>;
export type NetworksQuery = UseQueryResult<INetwork[]>;

// Key helpers
export const getNetworkRootKey = () => ['network'] as const;
export const getCurrentNetworkKey = () => ['network', 'current'] as const;
export const getNetworkListKey = () => ['network', 'all'] as const;

/**
 * Fetch the currently selected network.
 * @example
 * const { data: currentNetwork } = useCurrentNetwork();
 */
export function useCurrentNetwork(): NetworkQuery {
  const service = getNetworkService();
  return useQuery({
    queryKey: getCurrentNetworkKey(),
    queryFn: () => service.getCurrentNetwork(),
  });
}

/**
 * Fetch all networks.
 * @example
 * const { data: networks } = useNetworks();
 */
export function useNetworks(): NetworksQuery {
  const service = getNetworkService();
  return useQuery({
    queryKey: getNetworkListKey(),
    queryFn: () => service.getAllNetworks(),
  });
}

/**
 * Switch the selected network and refresh network queries.
 * @example
 * const switchNetwork = useSwitchNetwork();
 * await switchNetwork('net_1');
 */
export function useSwitchNetwork() {
  const service = getNetworkService();
  const queryClient = useQueryClient();
  return useCallback(
    async (networkId: string) => {
      await service.switchNetwork(networkId);
      await queryClient.invalidateQueries({ queryKey: getNetworkRootKey() });
    },
    [service, queryClient],
  );
}

/**
 * Update network endpoint and refresh network queries.
 * @example
 * const updateEndpoint = useUpdateEndpoint();
 * await updateEndpoint('net_1', 'https://rpc');
 */
export function useUpdateEndpoint() {
  const service = getNetworkService();
  const queryClient = useQueryClient();
  return useCallback(
    async (networkId: string, endpoint: string) => {
      await service.updateEndpoint(networkId, endpoint);
      await queryClient.invalidateQueries({ queryKey: getNetworkRootKey() });
    },
    [service, queryClient],
  );
}

/**
 * Add a new endpoint and refresh network queries.
 * @example
 * const addEndpoint = useAddEndpoint();
 * await addEndpoint('net_1', { endpoint: 'https://rpc', type: 'outer' });
 */
export function useAddEndpoint() {
  const service = getNetworkService();
  const queryClient = useQueryClient();
  return useCallback(
    async (networkId: string, entry: NetworkEndpointEntry) => {
      const added = await service.addEndpoint(networkId, entry);
      await queryClient.invalidateQueries({ queryKey: getNetworkRootKey() });
      return added;
    },
    [service, queryClient],
  );
}

/**
 * Remove an endpoint and refresh network queries.
 * @example
 * const removeEndpoint = useRemoveEndpoint();
 * await removeEndpoint('net_1', 'https://rpc');
 */
export function useRemoveEndpoint() {
  const service = getNetworkService();
  const queryClient = useQueryClient();
  return useCallback(
    async (networkId: string, endpoint: string) => {
      const removed = await service.removeEndpoint(networkId, endpoint);
      await queryClient.invalidateQueries({ queryKey: getNetworkRootKey() });
      return removed;
    },
    [service, queryClient],
  );
}
