import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import Welcome from '@pages/Welcome';
import WayToInitWallet from '@pages/WayToInitWallet';
import BiometricsWay from '@pages/InitWallet/BiometricsWay';
import PasswordWay from '@pages/InitWallet/PasswordWay';
import Home from '@pages/Home';
import Settings from '@pages/Settings';
import AccountManagement from '@pages/Management/AccountManagement';
import {
  WelcomeStackName,
  WayToInitWalletStackName,
  HomeStackName,
  BiometricsWayStackName,
  PasswordWayStackName,
  SettingsStackName,
  AccountManagementStackName,
  type RootStackParamList,
} from './configs';
import Header from './Header';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const screenOptions = {
  orientation: 'portrait',
  header: Header,
  headerBackVisible: false,
  statusBarTranslucent: true,
  statusBarBackgroundColor: 'transparent',
} as const;

const Router: React.FC = () => {
  const hasVault = useHasVault();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <RootStack.Navigator
        initialRouteName={hasVault ? HomeStackName : WelcomeStackName}
        screenOptions={{
          ...screenOptions,
        }}
      >
        <RootStack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false }} />
        <RootStack.Screen name={WayToInitWalletStackName} component={WayToInitWallet} options={{ headerShown: false }} />
        <RootStack.Screen name={HomeStackName} component={Home} options={{ headerShown: false }} />
        <RootStack.Screen name={BiometricsWayStackName} component={BiometricsWay} />
        <RootStack.Screen name={PasswordWayStackName} component={PasswordWay} />
        <RootStack.Screen name={AccountManagementStackName} component={AccountManagement} />
        <RootStack.Screen name={SettingsStackName} component={Settings} />
      </RootStack.Navigator>
    </View>
  );
};

export default Router;
