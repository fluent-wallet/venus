import { store } from '@core/WalletCore/Plugins/ReactInject';
import { Provider } from 'jotai';
import App from './App';

function RootProvider() {
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
}

export default RootProvider;
