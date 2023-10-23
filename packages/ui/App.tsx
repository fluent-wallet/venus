import { useEffect, type PropsWithChildren } from 'react';
import { Platform, useColorScheme, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider, useTheme } from '@rneui/themed';
import './assets/i18n';
import { theme } from './theme';
import Welcome, { WelcomeStackName } from '@pages/Welcome';
import SetPassword, { SetPasswordStackName } from '@pages/SetPassword';
import Biometrics, { BiometricsStackName } from '@pages/SetPassword/Biometrics';
import Wallet, { WalletStackName } from '@pages/Wallet';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import CreateAccount, { CreateAccountStackName } from '@pages/CreateAccount';
import AccountManage, { AccountManageStackName } from '@pages/AccountManage';
import { RootStackList } from 'packages/@types/natigation';

import WalletIcon from '@assets/icons/wallet.svg';

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
      }}
    >
      <BottomTabStack.Screen name={WalletStackName} component={Wallet} options={{ tabBarIcon: ({ color }) => <WalletIcon color={color} /> }} />
    </BottomTabStack.Navigator>
  );
};
const StackNavigator = ({ children }: PropsWithChildren) => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName={WelcomeStackName}
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
        statusBarTranslucent: true,
        statusBarColor: 'transparent',
        ...(Platform.OS === 'android' ? { statusBarStyle: theme.mode } : null),
      }}
    >
      {children}
    </Stack.Navigator>
  );
};

function App(): JSX.Element {
  const mode = useColorScheme();
  theme.mode = mode === 'dark' ? 'dark' : 'light';

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <ThemeProvider theme={theme}>
          <StackNavigator>
            <Stack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false }} />
            <Stack.Screen name={SetPasswordStackName} component={SetPassword} />
            <Stack.Screen name={BiometricsStackName} component={Biometrics} />
            <Stack.Screen name="Home" component={HomeScreenNavigator} options={{ headerShown: false }} />
            <Stack.Screen name={AccountManageStackName} component={AccountManage} options={{ title: 'Manage Wallets' }} />
            <Stack.Screen name={CreateAccountStackName} component={CreateAccount} />
          </StackNavigator>
        </ThemeProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
