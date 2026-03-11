import { buildScanOpenApiKey } from '@core/modules/nftSync';
import { createAppRuntime } from '@core/runtime/createAppRuntime';
import type { RuntimeConfig } from '@core/runtime/types';
import { Networks, NetworkType } from '@core/utils/consts';
import type { WalletKitTypes } from '@reown/walletkit';
import { setUiQueryClient, setUiServiceContainer } from '@service/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isProd, isQA } from '@utils/getEnv';
import { useEffect, useState } from 'react';
import App from './App';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });
setUiQueryClient(queryClient);

const LEGACY_TRACKER_POLL_INTERVAL_MS = 7777;

const WALLET_CONNECT_PROJECT_ID = '77ffee6a4cbf8ed25550cea82939d1fa';
const WALLET_CONNECT_METADATA = {
  name: 'BIM Wallet Wallet',
  description: 'BIM Wallet Wallet to interface with Dapps',
  url: 'https://bimwallet.io/',
  icons: ['https://download.bimwallet.io/assets/logo.png'],
} satisfies WalletKitTypes.Options['metadata'];

const WALLET_CONNECT_ALLOWED_EIP155_CHAINS = isProd
  ? [`eip155:${Networks['Conflux eSpace'].netId}`]
  : isQA
    ? [`eip155:${Networks['Conflux eSpace'].netId}`, `eip155:${Networks['eSpace Testnet'].netId}`]
    : undefined;

const RUNTIME_CONFIG: RuntimeConfig = {
  wallet: {
    pendingCountLimit: 5,
    pendingTimeBeforeSpeedUpMs: 15_000,
    gas: {
      minGasPriceGweiByNetworkType: {
        [NetworkType.Conflux]: 1,
      },
      minGasPriceGweiByChain: {
        [NetworkType.Ethereum]: {
          [Networks['Conflux eSpace'].chainId]: 20,
          [Networks['eSpace Testnet'].chainId]: 20,
        },
      },
    },
  },
  eventBus: {
    strictEmit: false,
    assertSerializable: false,
  },
  auth: {
    passwordRequestTtlMs: 2 * 60 * 1000,
  },
  externalRequests: {
    requestTtlMs: 5 * 60 * 1000,
    sweepIntervalMs: 60 * 1000,
    maxActiveRequests: 1,
  },
  walletConnect: {
    projectId: WALLET_CONNECT_PROJECT_ID,
    metadata: WALLET_CONNECT_METADATA,
    allowedEip155Chains: WALLET_CONNECT_ALLOWED_EIP155_CHAINS,
  },
  sync: {
    assets: {
      pollIntervalMs: LEGACY_TRACKER_POLL_INTERVAL_MS,
    },
    tx: {
      globalConcurrency: 4,
      highPriorityPollIntervalMs: 10_000,
      backgroundPollIntervalMs: 60_000,
      scanIntervalMs: 60_000,
    },
    nft: {
      pollIntervalMs: LEGACY_TRACKER_POLL_INTERVAL_MS,
      scanOpenApiByKey: {
        [buildScanOpenApiKey({ networkType: NetworkType.Ethereum, chainId: Networks['Conflux eSpace'].chainId })]: Networks['Conflux eSpace'].scanOpenAPI,
        [buildScanOpenApiKey({ networkType: NetworkType.Ethereum, chainId: Networks['eSpace Testnet'].chainId })]: Networks['eSpace Testnet'].scanOpenAPI,
      },
    },
  },
};

let bootOnce: Promise<void> | null = null;

async function bootAppOnce(): Promise<void> {
  if (bootOnce) return bootOnce;

  bootOnce = (async () => {
    const runtime = createAppRuntime({
      config: RUNTIME_CONFIG,
    });

    runtime.prepare();
    setUiServiceContainer(runtime.context.container);

    await runtime.start();
  })();

  return bootOnce;
}

function RootProvider() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<unknown>(null);

  useEffect(() => {
    bootAppOnce()
      .then(() => setReady(true))
      .catch((error) => setBootError(error));
  }, []);

  if (bootError) throw bootError;
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

export default RootProvider;
