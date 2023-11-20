import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import './packages/setup/getRandomValues';
import '@ethersproject/shims';
import './packages/setup/ethers';
import WalletCore from './packages/core/WalletCore';
import ReactInjectPlugin from './packages/core/WalletCore/Plugins/ReactInject';
import CryptoToolPlugin from './packages/WalletCoreExtends/Plugins/CryptoTool';
import AuthenticationPlugin from './packages/WalletCoreExtends/Plugins/Authentication';
import BSIMPlugin from './packages/WalletCoreExtends/Plugins/BSIM';
import App from './packages/ui/App';
import { name as appName } from './app.json';

WalletCore.plugins.use([CryptoToolPlugin, AuthenticationPlugin, BSIMPlugin, ReactInjectPlugin]);
WalletCore.setup();

AppRegistry.registerComponent(appName, () => App);
