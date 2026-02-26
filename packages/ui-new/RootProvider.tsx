import { initCore } from '@WalletCoreExtends/index';
import { AuthenticationPlugin } from '@WalletCoreExtends/Plugins/Authentication';
import BSIMPlugin from '@WalletCoreExtends/Plugins/BSIM';
import { CryptoToolPlugin } from '@WalletCoreExtends/Plugins/CryptoTool';
import database from '@core/database';
import { createAppRuntime } from '@core/runtime/createAppRuntime';
import type { RuntimeConfig } from '@core/runtime/types';
import { Networks, NetworkType } from '@core/utils/consts';
import WalletCore from '@core/WalletCore';
import { DbPlugin } from '@core/WalletCore/DB';
import { EventPlugin } from '@core/WalletCore/Events/EventPlugin';
import { methodPlugins } from '@core/WalletCore/Methods';
import { AssetsTrackerPlugin } from '@core/WalletCore/Plugins/AssetsTracker';
import BlockNumberTracker from '@core/WalletCore/Plugins/BlockNumberTracker';
import { NextNonceTrackerPlugin } from '@core/WalletCore/Plugins/NextNonceTracker';
import { NFTDetailTrackerPlugin } from '@core/WalletCore/Plugins/NFTDetailTracker';
import ReactInjectPlugin, { store } from '@core/WalletCore/Plugins/ReactInject';
import { ReceiveAssetsTrackerPlugin } from '@core/WalletCore/Plugins/ReceiveAssetsTracker';
import TransactionPlugin from '@core/WalletCore/Plugins/Transaction';
import { TxTrackerPlugin } from '@core/WalletCore/Plugins/TxTracker';
import { WalletConfigPlugin } from '@core/WalletCore/Plugins/WalletConfig';
import WalletConnectPlugin from '@core/WalletCore/Plugins/WalletConnect';
import type { WalletKitTypes } from '@reown/walletkit';
import { setUiQueryClient, setUiServiceContainer } from '@service/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { useEffect, useState } from 'react';
import App from './App';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });
setUiQueryClient(queryClient);

const WALLET_CONNECT_PROJECT_ID = '77ffee6a4cbf8ed25550cea82939d1fa';
const WALLET_CONNECT_METADATA = {
  name: 'BIM Wallet Wallet',
  description: 'BIM Wallet Wallet to interface with Dapps',
  url: 'https://bimwallet.io/',
  icons: ['https://download.bimwallet.io/assets/logo.png'],
} satisfies WalletKitTypes.Options['metadata'];

const RUNTIME_CONFIG: RuntimeConfig = {
  wallet: {
    pendingCountLimit: 5,
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
  },
  sync: {
    tx: {
      globalConcurrency: 4,
      highPriorityPollIntervalMs: 10_000,
      backgroundPollIntervalMs: 60_000,
      scanIntervalMs: 60_000,
    },
  },
};

let bootOnce: Promise<void> | null = null;

async function bootAppOnce(): Promise<void> {
  if (bootOnce) return bootOnce;

  bootOnce = (async () => {
    const runtime = createAppRuntime({
      database,
      config: RUNTIME_CONFIG,
    });

    runtime.prepare();
    setUiServiceContainer(runtime.context.container);

    await runtime.start();

    const core = await initCore(
      EventPlugin,
      DbPlugin,
      AuthenticationPlugin,
      CryptoToolPlugin,
      TxTrackerPlugin,
      NFTDetailTrackerPlugin,
      ReceiveAssetsTrackerPlugin,
      AssetsTrackerPlugin,
      NextNonceTrackerPlugin,
      WalletConfigPlugin,
      methodPlugins,
    ).bootstrap();

    WalletCore.plugins.use([
      { name: 'CryptoTool', encrypt: core.cryptoTool.encrypt, decrypt: core.cryptoTool.decrypt },
      BSIMPlugin,
      ReactInjectPlugin,
      TransactionPlugin,
      BlockNumberTracker,
      new WalletConnectPlugin({
        projectId: WALLET_CONNECT_PROJECT_ID,
        metadata: WALLET_CONNECT_METADATA,
      }),
    ]);

    // Legacy setup is intentionally fire-and-forget; runtime is the source of truth in migration.
    WalletCore.setup();
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
      <Provider store={store}>
        <App />
      </Provider>
    </QueryClientProvider>
  );
}

export default RootProvider;
