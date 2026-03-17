import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

let isReactQueryTestNotifyConfigured = false;

function configureReactQueryTestNotifyManager() {
  if (isReactQueryTestNotifyConfigured) {
    return;
  }

  notifyManager.setNotifyFunction((callback) => {
    act(() => {
      callback();
    });
  });

  isReactQueryTestNotifyConfigured = true;
}

export function createTestQueryClient() {
  configureReactQueryTestNotifyManager();

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });

  return client;
}

export function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
