import React, { type PropsWithChildren } from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@rneui/themed';
import Welcome, { WelcomeStackName } from '@pages/Welcome';
import SetPassword, { SetPasswordStackName } from '@pages/SetPassword';
import Biometrics, { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import Wallet, { WalletStackName, getWalletHeaderOptions } from '@pages/Wallet';
import Settings, { SettingsStackName } from '@pages/Settings';
import ImportWallet, { ImportWalletStackName } from '@pages/ImportWallet';
import AccountManage, { AccountManageStackName } from '@pages/AccountManage';
import { withDatabase, withObservables, compose, type Database } from '@DB/react';
import TableName from '@DB/TableName';
import { HomeStackName, type StackNavigation, type RootStackList } from './configs';
import WalletIcon from '@assets/icons/wallet.svg';
import SettingsIcon from '@assets/icons/settings.svg';
import ArrowLeft from '@assets/icons/arrow-left.svg';

const Stack = createNativeStackNavigator<RootStackList>();
const BottomTabStack = createBottomTabNavigator();

const HomeScreenNavigator = () => {
  const { theme } = useTheme();
  return (
    <BottomTabStack.Navigator
      initialRouteName={WalletStackName}
      screenOptions={{
        headerTitleAlign: 'left',
        headerTransparent: true,
        tabBarActiveBackgroundColor: theme.colors.pureBlackAndWight,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        tabBarInactiveBackgroundColor: theme.colors.pureBlackAndWight,
        tabBarStyle: {
          borderTopWidth: 0,
        },
      }}
    >
      <BottomTabStack.Screen
        name={WalletStackName}
        component={Wallet}
        options={{ tabBarIcon: ({ color }) => <WalletIcon color={color} />, ...getWalletHeaderOptions(theme.colors.homeHeaderAddressBackgroundColor) }}
      />
      <BottomTabStack.Screen
        name={SettingsStackName}
        component={Settings}
        options={{ headerShown: false, tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }}
      />
    </BottomTabStack.Navigator>
  );
};

const StackNavigator = compose(
  withDatabase,
  withObservables([], ({ database }: { database: Database }) => ({ vaultCount: database.collections.get(TableName.Vault).query().observeCount() }))
)(({ children, vaultCount }: PropsWithChildren & { vaultCount: number }) => {
  const navigation = useNavigation<StackNavigation>();
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName={vaultCount > 0 ? HomeStackName : WelcomeStackName}
      screenOptions={{
        headerTitleAlign: 'left',
        headerTransparent: true,
        headerBackVisible: false,
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <TouchableOpacity className="flex flex-row items-center gap-[4px]" onPress={() => navigation.goBack()}>
              <ArrowLeft />
              <Text className="text-[16px] font-medium" style={{ color: theme.colors.textBrand }}>
                Wallet
              </Text>
            </TouchableOpacity>
          ) : null,
        title: '',
        headerTitleStyle: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
        statusBarTranslucent: true,
        statusBarColor: 'transparent',
        ...(Platform.OS === 'android' ? { statusBarStyle: theme.mode } : null),
      }}
    >
      {children}
    </Stack.Navigator>
  );
});

const Router: React.FC = () => {
  return (
    <NavigationContainer>
      <StackNavigator>
        <Stack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false }} />
        <Stack.Screen name={SetPasswordStackName} component={SetPassword} />
        <Stack.Screen name={BiometricsStackName} component={Biometrics} />
        <Stack.Screen name={HomeStackName} component={HomeScreenNavigator} options={{ headerShown: false }} />
        <Stack.Screen name={AccountManageStackName} component={AccountManage} options={{ title: 'Manage Wallets', headerTitleAlign: 'center' }} />
        <Stack.Screen name={ImportWalletStackName} component={ImportWallet} />
      </StackNavigator>
    </NavigationContainer>
  );
};

export default Router;
