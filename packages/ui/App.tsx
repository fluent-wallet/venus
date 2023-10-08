import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Welcome from '@pages/Welcome';
import SetPassword from '@pages/SetPassword';
import Home from '@pages/Home';
import { authentication, AuthenticationType, cryptoTool } from '@DB/helper';
authentication.setPassword({ password: '123456', authType: AuthenticationType.Password });
(async function() {
  console.log('start')
  try {
    const encryptedData = await cryptoTool.encrypt({ test: '12345 ' });
    // console.log('encrypt', encryptedData)
  } catch (err) {
    console.log('err', err);
    // console.log(await cryptoTool.decrypt(d));  

  }
}());

function App(): JSX.Element {
  const Stack = createNativeStackNavigator();
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Welcome">
          <Stack.Screen name="Welcome" component={Welcome} />
          <Stack.Screen name="SetPassword" component={SetPassword} />
          <Stack.Screen name="Home" component={Home} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
