import 'react-native-gesture-handler';
import '@walletconnect/react-native-compat';
import { AppRegistry, Platform, LogBox } from 'react-native';
import './packages/setup/getRandomValues';
import '@ethersproject/shims';
import './packages/setup/ethers';
import codePush from 'react-native-code-push';
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
import App from './packages/ui-new/App';
import { name as appName } from './app.json';
import { ENABLE_WALLET_CONNECT_FEATURE } from './packages/ui/utils/features';
import * as SplashScreen from 'expo-splash-screen';
LogBox.ignoreLogs(['RCTBridge required dispatch_sync to load']);

// Prevent native splash screen from autohiding before App component declaration
SplashScreen.preventAutoHideAsync()
  .then((result) => console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`))
  .catch(console.warn); // it's good to explicitly catch and inspect any error

const plugins = [CryptoToolPlugin, AuthenticationPlugin, BSIMPlugin, ReactInjectPlugin, AssetsTracker, TxTrackerPlugin, TransactionPlugin, NFTDetailTracker];

if (ENABLE_WALLET_CONNECT_FEATURE.allow) {
  plugins.push(new WalletConnectPlugin());
}

WalletCore.plugins.use(plugins);
WalletCore.setup();

// by now the code push only works on android, if you want to run on ios, need to apply the code push config on ios see: https://github.com/microsoft/react-native-code-push/blob/master/docs/setup-ios.md
if (__DEV__ || Platform.OS === 'ios') {
  AppRegistry.registerComponent(appName, () => App);
} else {
  AppRegistry.registerComponent(appName, () => codePush(App));
}
