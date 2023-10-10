import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider } from '@rneui/themed';
import './assets/i18n'
import { theme } from './theme';

import Welcome from '@pages/Welcome';
import SetPassword from '@pages/SetPassword';
import Home from '@pages/Home';

import { authentication, AuthenticationType, cryptoTool } from '@DB/helper';



(async function () {
  console.log('start');
  try {
    await authentication.setPassword({ password: '123456', authType: AuthenticationType.Password });
    const encryptedData = await cryptoTool.encrypt({ test: '12345 ' });
    // console.log('encrypt', encryptedData)
  } catch (err) {
    console.log('err', err);
    // console.log(await cryptoTool.decrypt(d));
  }
})();

function App(): JSX.Element {
  const Stack = createNativeStackNavigator();
  const mode = useColorScheme();
  // fix type error
  theme.mode = mode === 'dark' ? 'dark' : 'light';
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <ThemeProvider theme={theme}>
          <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Welcome" component={Welcome} />
            <Stack.Screen name="SetPassword" component={SetPassword} />
            <Stack.Screen name="Home" component={Home} />
          </Stack.Navigator>
        </ThemeProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
