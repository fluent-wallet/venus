import { store } from '@core/WalletCore/Plugins/ReactInject';
import { Provider } from 'jotai';
import App from './App';
import { WalletCoreContext } from './contexts/WalletCoreContext';
import { getCore } from '@WalletCoreExtends/index';

function RootProvider() {
  return (
    <Provider store={store}>
      <WalletCoreContext.Provider value={getCore()}>
        <App />
      </WalletCoreContext.Provider>
    </Provider>
  );
}

export default RootProvider;
