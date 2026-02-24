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
import { name as appName } from './app.json';
import RootProvider from './packages/ui-new/RootProvider';

Decimal.set({ precision: 80 });
Decimal.config({
  toExpNeg: -80,
  toExpPos: 80,
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

// Register synchronously; boot logic runs inside RootProvider during mount.
AppRegistry.registerComponent(appName, () => RootProvider);
