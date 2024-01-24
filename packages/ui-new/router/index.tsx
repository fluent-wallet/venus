import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import Welcome from '@pages/Welcome';
import WayToInitWallet from '@pages/WayToInitWallet';
import Home from '@pages/WayToInitWallet';
import { WelcomeStackName, WayToInitWalletStackName, HomeStackName, type RootStackParamList } from './configs';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const Router: React.FC = () => {
  const hasVault = useHasVault();

  return (
    <RootStack.Navigator
      initialRouteName={hasVault ? HomeStackName : WelcomeStackName}
      screenOptions={{
        statusBarTranslucent: true,
        statusBarBackgroundColor: 'transparent',
        headerShown: false,
      }}
    >
      <RootStack.Screen name={WelcomeStackName} component={Welcome} />
      <RootStack.Screen name={WayToInitWalletStackName} component={WayToInitWallet} />
      <RootStack.Screen name={HomeStackName} component={Home} />
    </RootStack.Navigator>
  );
};

export default Router;
