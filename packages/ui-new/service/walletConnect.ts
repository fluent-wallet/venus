import type { WalletConnectSessionSnapshot } from '@core/modules/walletConnect';
import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getWalletConnectService } from './core';
import { useCurrentNetwork } from './network';
import { getWalletConnectRootKey } from './walletConnectKeys';

export type WalletConnectSessionsQuery = UseQueryResult<WalletConnectSessionSnapshot[]>;

export const getWalletConnectSessionsKey = (params: { filterByAddress?: string | undefined | null; netId?: number | null }) =>
  [
    ...getWalletConnectRootKey(),
    'sessions',
    params.filterByAddress ? params.filterByAddress.toLowerCase() : 'all',
    params.netId != null ? String(params.netId) : 'anyNet',
  ] as const;

const parseEip155Account = (value: string): { chain: string; address: string } | null => {
  // Expected: eip155:<chainId>:<address>
  const parts = value.split(':');
  if (parts.length !== 3) return null;
  if (parts[0] !== 'eip155') return null;
  const chain = parts[1];
  const address = parts[2];
  if (!chain || !address) return null;
  return { chain, address };
};

function matchesAnyAddress(session: WalletConnectSessionSnapshot, addresses: string[], netId?: number | null): boolean {
  if (!addresses.length) return false;
  const target = new Set(addresses.map((a) => a.toLowerCase()));
  const accounts = session.namespaces.eip155?.accounts ?? [];
  for (const account of accounts) {
    const parsed = parseEip155Account(account);
    if (!parsed) continue;
    if (netId != null && parsed.chain !== String(netId)) continue;
    if (target.has(parsed.address.toLowerCase())) return true;
  }
  return false;
}

/**
 * Fetch WalletConnect sessions (runtime module).
 */
export function useWalletConnectSessions(filterByAddress?: string | undefined | null): WalletConnectSessionsQuery {
  const service = getWalletConnectService();
  const currentNetwork = useCurrentNetwork();
  const netId = currentNetwork.data?.netId ?? null;
  return useQuery({
    queryKey: getWalletConnectSessionsKey({ filterByAddress, netId }),
    queryFn: () => service.getSessions(),
    initialData: [],
    select: (sessions) => {
      if (!filterByAddress) return sessions;
      return sessions.filter((session) => matchesAnyAddress(session, [filterByAddress], netId));
    },
  });
}

export function usePairWalletConnectUri() {
  const service = getWalletConnectService();
  const queryClient = useQueryClient();

  return useCallback(
    async (uri: string) => {
      await service.pair(uri);
      await queryClient.invalidateQueries({ queryKey: getWalletConnectRootKey() });
    },
    [queryClient, service],
  );
}

export function useDisconnectWalletConnectSession() {
  const service = getWalletConnectService();
  const queryClient = useQueryClient();

  return useCallback(
    async (topic: string) => {
      await service.disconnect(topic);
      await queryClient.invalidateQueries({ queryKey: getWalletConnectRootKey() });
    },
    [queryClient, service],
  );
}

export function useDisconnectAllWalletConnectSessions() {
  const service = getWalletConnectService();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    const sessions = service.getSessions();
    await Promise.all(sessions.map((s) => service.disconnect(s.topic)));
    await queryClient.invalidateQueries({ queryKey: getWalletConnectRootKey() });
  }, [queryClient, service]);
}

export function useDisconnectWalletConnectSessionsByAddresses() {
  const service = getWalletConnectService();
  const queryClient = useQueryClient();

  return useCallback(
    async (addresses: string[]) => {
      const sessions = service.getSessions();
      const targets = sessions.filter((s) => matchesAnyAddress(s, addresses));
      await Promise.all(targets.map((s) => service.disconnect(s.topic)));
      await queryClient.invalidateQueries({ queryKey: getWalletConnectRootKey() });
    },
    [queryClient, service],
  );
}
