import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import './packages/setup/getRandomValues';
import '@ethersproject/shims';
import './packages/setup/ethers';
import './packages/core/database/setup';
import WalletCore from './packages/core/WalletCore';
import ReactInjectPlugin from './packages/core/WalletCore/plugins/ReactInject';
import CryptoToolPlugin from './packages/WalletCoreExtends/plugins/CryptoTool';
import AuthenticationPlugin from './packages/WalletCoreExtends/plugins/Authentication';
import BSIMPlugin from './packages/WalletCoreExtends/plugins/BSIM';
import App from './packages/ui/App';
import { name as appName } from './app.json';

WalletCore.plugins.use([CryptoToolPlugin, AuthenticationPlugin, BSIMPlugin, ReactInjectPlugin]);
AppRegistry.registerComponent(appName, () => App);
