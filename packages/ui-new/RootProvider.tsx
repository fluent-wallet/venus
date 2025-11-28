import { store } from '@core/WalletCore/Plugins/ReactInject';
import { Provider } from 'jotai';
import App from './App';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setUiQueryClient } from '@service/core';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });
setUiQueryClient(queryClient);

function RootProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <App />
      </Provider>
    </QueryClientProvider>
  );
}

export default RootProvider;
