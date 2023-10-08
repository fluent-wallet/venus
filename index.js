/**
 * @format
 */

import {AppRegistry} from 'react-native';
import './ethers-setup'
import "@ethersproject/shims"
import App from './packages/ui/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
