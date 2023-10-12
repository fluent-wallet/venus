import { useEffect, type PropsWithChildren } from 'react';
import { Platform, useColorScheme, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from '@rneui/themed';
import './assets/i18n';
import { theme } from './theme';
import Welcome from '@pages/Welcome';
import SetPassword from '@pages/SetPassword';
import Biometrics from '@pages/SetPassword/Biometrics';
import Home from '@pages/Home';
import ArrowLeft from '@assets/icons/arrow-left.svg';
import { generateMnemonic } from '@core/utils/mnemonic';
import { Wallet } from 'ethers';

(function () {
  const now = performance.now()
  for (let i = 0; i < 1; i++) {
    // generateMnemonic();
    console.log(Wallet.createRandom());
  }

  const end = performance.now()
  console.log(
    `💰 New wallet created! Took ${end - now}ms`,
  )
})();

const Stack = createNativeStackNavigator();
const StackNavigator = ({ children }: PropsWithChildren) => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerTitleAlign: 'left',
        headerTransparent: true,
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
  useEffect(() => {
    theme.mode = mode === 'dark' ? 'dark' : 'light';
  }, [mode]);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <ThemeProvider theme={theme}>
          <StackNavigator>
            <Stack.Screen name="Welcome" component={Welcome} options={{ headerShown: false }} />
            <Stack.Screen name="SetPassword" component={SetPassword} />
            <Stack.Screen name="Biometrics" component={Biometrics} />
            <Stack.Screen name="Home" component={Home} />
          </StackNavigator>
        </ThemeProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
