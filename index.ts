import './packages/setup/process';
import 'react-native-gesture-handler';
// this package is polyfill  TextEncode / TextDecode crypto.getRandomvalues URL() Buffer
import '@walletconnect/react-native-compat';
import { AppRegistry, LogBox } from 'react-native';

// import './packages/setup/getRandomValues';   the randomValues is polyfill for @walletconnect/react-native-compat

import '@ethersproject/shims';
import './packages/setup/ethers';
import './packages/setup/polyfill';
import Decimal from 'decimal.js';
import WalletCore from './packages/core/WalletCore';
import TxTrackerPlugin from './packages/core/WalletCore/Plugins/TxTracker';
import ReactInjectPlugin from './packages/core/WalletCore/Plugins/ReactInject';
import WalletConnectPlugin from './packages/core/WalletCore/Plugins/WalletConnect';
import AssetsTracker from './packages/core/WalletCore/Plugins/AssetsTracker';
import CryptoToolPlugin from './packages/WalletCoreExtends/Plugins/CryptoTool';
import AuthenticationPlugin from './packages/WalletCoreExtends/Plugins/Authentication';
import BSIMPlugin from './packages/WalletCoreExtends/Plugins/BSIM';
import TransactionPlugin from './packages/core/WalletCore/Plugins/Transaction';
import NFTDetailTracker from './packages/core/WalletCore/Plugins/NFTDetailTracker';
import ReceiveAssetsTracker from './packages/core/WalletCore/Plugins/ReceiveAssetsTracker';
import BlockNumberTracker from './packages/core/WalletCore/Plugins/BlockNumberTracker';
import NextNonceTracker from './packages/core/WalletCore/Plugins/NextNonceTracker';
import WalletConfigPlugin from './packages/core/WalletCore/Plugins/WalletConfig';
import App from './packages/ui-new/App';
import { name as appName } from './app.json';

Decimal.set({ precision: 80 });
Decimal.config({
  toExpNeg: -80,
  toExpPos: 80
});

LogBox.ignoreLogs([
  'WebSocket connection failed for host',
  'Socket stalled when trying to connect',
  'Error: Invalid response',
  'Request timed out',
  'RCTBridge required dispatch_sync to load',
  'network does not support ENS',
  '[Reanimated]',
    // TODO: Remove when https://github.com/gorhom/react-native-bottom-sheet/issues/1854 is fixed.
  /^\[Reanimated\] Tried to modify key `reduceMotion` of an object which has been already passed to a worklet/,
]);

const plugins = [
  CryptoToolPlugin,
  AuthenticationPlugin,
  BSIMPlugin,
  ReactInjectPlugin,
  AssetsTracker,
  TxTrackerPlugin,
  TransactionPlugin,
  NFTDetailTracker,
  ReceiveAssetsTracker,
  BlockNumberTracker,
  NextNonceTracker,
  WalletConfigPlugin,

    new WalletConnectPlugin({
      projectId: '77ffee6a4cbf8ed25550cea82939d1fa',
      metadata: {
        name: 'BIM Wallet Wallet',
        description: 'BIM Wallet Wallet to interface with Dapps',
        url: 'https://bimwallet.io/',
        icons: ['https://download.bimwallet.io/assets/logo.png'],
      },
    }),
  
];



WalletCore.plugins.use(plugins);
WalletCore.setup();

AppRegistry.registerComponent(appName, () => App);
