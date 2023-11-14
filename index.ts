import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import './packages/mobile/setup/getRandomValues';
import '@ethersproject/shims';
import './packages/mobile/setup/ethers';
import './packages/core/database/setup';
import WalletCore from './packages/core/WalletCore';
import { CryptoTool } from './packages/mobile/plugins/CryptoTool';
import { Authentication } from './packages/mobile/plugins/Authentication';

import App from './packages/ui/App';
import { name as appName } from './app.json';

WalletCore.plugins.use([CryptoTool, Authentication]);
AppRegistry.registerComponent(appName, () => App);
