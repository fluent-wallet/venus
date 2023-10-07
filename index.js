/**
 * @format
 */

import {AppRegistry} from 'react-native';
import "@ethersproject/shims"
import './ethers-setup'
import App from './packages/ui/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
