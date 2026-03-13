import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { NetworkType } from '@core/types';
import type { INetwork } from '@service/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const RPC_METRICS_POLL_INTERVAL_MS = 25_000;
const RPC_METRICS_RETRY_DELAY_MS = 1_000;

export type RpcEndpointMetrics = {
  latency: number | null;
  blockNumber: bigint | null;
};

type RpcMetricsMap = Record<string, RpcEndpointMetrics>;

const createEmptyMetrics = (): RpcEndpointMetrics => ({
  latency: null,
  blockNumber: null,
});

const getScopedEndpointKey = (scope: number, endpoint: string) => `${scope}:${endpoint}`;

const hasSameEndpointSet = (metricsByEndpoint: RpcMetricsMap, endpoints: string[]) =>
  Object.keys(metricsByEndpoint).length === endpoints.length && endpoints.every((endpoint) => metricsByEndpoint[endpoint] !== undefined);

const syncMetricsShape = (previous: RpcMetricsMap, endpoints: string[]): RpcMetricsMap => {
  if (hasSameEndpointSet(previous, endpoints)) {
    return previous;
  }

  const next: RpcMetricsMap = {};

  for (const endpoint of endpoints) {
    next[endpoint] = previous[endpoint] ?? createEmptyMetrics();
  }

  return next;
};

const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';

const fetchRpcBlockNumber = async (networkType: INetwork['networkType'], endpoint: string, signal: AbortSignal): Promise<bigint> => {
  if (networkType === NetworkType.Conflux) {
    const result = await fetchChain<string>({
      url: endpoint,
      method: 'cfx_epochNumber',
      params: ['latest_state'],
      options: { signal },
    });
    return BigInt(result);
  }

  const result = await fetchChain<string>({
    url: endpoint,
    method: 'eth_blockNumber',
    options: { signal },
  });
  return BigInt(result);
};

const fetchRpcLatency = async (endpoint: string, signal: AbortSignal): Promise<number> => {
  const startedAt = Date.now();

  try {
    await fetch(endpoint, { signal });
    return Date.now() - startedAt;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return -1;
  }
};

export function useRpcMetrics(currentNetwork: INetwork | null | undefined) {
  const [metricsByEndpoint, setMetricsByEndpoint] = useState<RpcMetricsMap>({});
  const scopeRef = useRef(0);
  const inFlightByEndpointRef = useRef(new Map<string, Promise<void>>());
  const abortControllerByEndpointRef = useRef(new Map<string, AbortController>());
  const retryTimeoutByEndpointRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const previousNetworkIdRef = useRef<string | null>(null);

  const networkId = currentNetwork?.id ?? null;
  const networkType = currentNetwork?.networkType ?? null;
  const endpoints = useMemo(() => currentNetwork?.endpointsList.map((item) => item.endpoint) ?? [], [currentNetwork?.endpointsList]);

  const mergeEndpointMetrics = useCallback((scope: number, endpoint: string, patch: Partial<RpcEndpointMetrics>) => {
    if (scope !== scopeRef.current) return;

    setMetricsByEndpoint((previous) => {
      const current = previous[endpoint] ?? createEmptyMetrics();
      const next = { ...current, ...patch };

      if (current.latency === next.latency && current.blockNumber === next.blockNumber) {
        return previous;
      }

      return {
        ...previous,
        [endpoint]: next,
      };
    });
  }, []);

  const clearRetryTimeout = useCallback((requestKey: string) => {
    const timeoutId = retryTimeoutByEndpointRef.current.get(requestKey);
    if (!timeoutId) return;

    clearTimeout(timeoutId);
    retryTimeoutByEndpointRef.current.delete(requestKey);
  }, []);

  const refreshEndpointMetrics = useCallback(
    async (scope: number, nextNetworkType: INetwork['networkType'], endpoint: string) => {
      const requestKey = getScopedEndpointKey(scope, endpoint);
      clearRetryTimeout(requestKey);

      const existing = inFlightByEndpointRef.current.get(requestKey);
      if (existing) {
        await existing;
        return;
      }

      const scheduleRetry = () => {
        if (scope !== scopeRef.current) return;
        if (retryTimeoutByEndpointRef.current.has(requestKey)) return;

        const timeoutId = setTimeout(() => {
          if (retryTimeoutByEndpointRef.current.get(requestKey) !== timeoutId) return;
          retryTimeoutByEndpointRef.current.delete(requestKey);

          if (scope !== scopeRef.current) return;
          void refreshEndpointMetrics(scope, nextNetworkType, endpoint);
        }, RPC_METRICS_RETRY_DELAY_MS);

        retryTimeoutByEndpointRef.current.set(requestKey, timeoutId);
      };

      const controller = new AbortController();
      abortControllerByEndpointRef.current.set(requestKey, controller);

      const task = (async () => {
        await Promise.allSettled([
          fetchRpcBlockNumber(nextNetworkType, endpoint, controller.signal)
            .then((blockNumber) => {
              mergeEndpointMetrics(scope, endpoint, { blockNumber });
            })
            .catch((error) => {
              if (!isAbortError(error)) {
                scheduleRetry();
              }
            }),
          fetchRpcLatency(endpoint, controller.signal).then((latency) => {
            mergeEndpointMetrics(scope, endpoint, { latency });
          }),
        ]);
      })();

      inFlightByEndpointRef.current.set(requestKey, task);

      try {
        await task;
      } finally {
        if (abortControllerByEndpointRef.current.get(requestKey) === controller) {
          abortControllerByEndpointRef.current.delete(requestKey);
        }
        if (inFlightByEndpointRef.current.get(requestKey) === task) {
          inFlightByEndpointRef.current.delete(requestKey);
        }
      }
    },
    [clearRetryTimeout, mergeEndpointMetrics],
  );

  const refreshMetrics = useCallback(
    async (targetEndpoints?: string[]) => {
      if (!networkId || !networkType) return;

      const endpointsToRefresh = targetEndpoints?.length ? [...new Set(targetEndpoints.filter(Boolean))] : endpoints;
      if (!endpointsToRefresh.length) return;

      const scope = scopeRef.current;
      await Promise.all(endpointsToRefresh.map((endpoint) => refreshEndpointMetrics(scope, networkType, endpoint)));
    },
    [endpoints, networkId, networkType, refreshEndpointMetrics],
  );

  useEffect(() => {
    if (!networkId) {
      previousNetworkIdRef.current = null;
      setMetricsByEndpoint((previous) => (Object.keys(previous).length ? {} : previous));
      return;
    }

    const networkChanged = previousNetworkIdRef.current !== networkId;
    previousNetworkIdRef.current = networkId;

    setMetricsByEndpoint((previous) => {
      if (networkChanged) {
        const next: RpcMetricsMap = {};

        for (const endpoint of endpoints) {
          next[endpoint] = createEmptyMetrics();
        }

        return next;
      }

      return syncMetricsShape(previous, endpoints);
    });
  }, [networkId, endpoints]);

  useEffect(() => {
    if (!networkId || !networkType || !endpoints.length) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const scope = scopeRef.current;

    const run = async () => {
      const startedAt = Date.now();
      await refreshMetrics();

      if (cancelled || scope !== scopeRef.current) {
        return;
      }

      const elapsedMs = Date.now() - startedAt;
      timeoutId = setTimeout(run, Math.max(0, RPC_METRICS_POLL_INTERVAL_MS - elapsedMs));
    };

    void run();

    return () => {
      cancelled = true;
      scopeRef.current += 1;

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      for (const retryTimeoutId of retryTimeoutByEndpointRef.current.values()) {
        clearTimeout(retryTimeoutId);
      }
      retryTimeoutByEndpointRef.current.clear();

      for (const controller of abortControllerByEndpointRef.current.values()) {
        controller.abort();
      }
      abortControllerByEndpointRef.current.clear();
      inFlightByEndpointRef.current.clear();
    };
  }, [networkId, networkType, endpoints, refreshMetrics]);

  return {
    metricsByEndpoint,
    refreshMetrics,
  };
}
