import { AppRegistry } from 'react-native';
import './packages/setup/getRandomValues';
import '@ethersproject/shims';
import './packages/setup/ethers';
import App from './packages/ui/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
