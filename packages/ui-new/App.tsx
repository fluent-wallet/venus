import React, { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FlashMessage from 'react-native-flash-message';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { JotaiNexus, useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import CustomMessage from '@modules/CustomMessage';
import { palette, lightColors, darkColors, fonts } from './theme';
import Router from './router';
import '@assets/i18n';
import * as SplashScreen from 'expo-splash-screen';


const App: React.FC = () => {
  const mode = useColorScheme();
  const hasVault = useHasVault();
  const theme = useMemo(
    () => ({
      mode: mode === 'dark' ? 'dark' : 'light',
      palette,
      fonts,
      colors: mode === 'dark' ? darkColors : lightColors,
    }),
    [mode],
  );
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer theme={theme as unknown as Theme}>
          {typeof hasVault === 'boolean' && <Router />}
          <FlashMessage position="bottom" MessageComponent={CustomMessage} duration={1500} animated={false} />
        </NavigationContainer>
      </GestureHandlerRootView>
      <JotaiNexus />
    </>
  );
};

export default App;
