import React, { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BootSplash from 'react-native-bootsplash';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { JotaiNexus, useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import { palette, lightColors, darkColors, fonts } from './theme';
import Router from './router';
import '@assets/i18n';

let hasInit = false;
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
    if (!hasInit && typeof hasVault === 'boolean') {
      hasInit = true;
      BootSplash.hide();
    }
  }, [hasVault]);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer theme={theme as unknown as Theme}>{typeof hasVault === 'boolean' && <Router />}</NavigationContainer>
      </GestureHandlerRootView>
      <JotaiNexus />
    </>
  );
};

export default App;
