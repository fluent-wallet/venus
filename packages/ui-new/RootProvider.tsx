import { store } from '@core/WalletCore/Plugins/ReactInject';
import { setUiQueryClient } from '@service/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import App from './App';

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
