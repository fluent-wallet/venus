import React, { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FlashMessage from 'react-native-flash-message';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { JotaiNexus, useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import CustomMessage from '@modules/CustomMessage';
import { statusBarHeight, OS, supports3DStructureLight } from './utils/deviceInfo';
import { useMode } from '@hooks/useMode';
import { palette, lightColors, darkColors, fonts } from './theme';
import Router from './router';
import '@assets/i18n';

const messagesTop = { top: statusBarHeight + 20 + (OS === 'android' ? 0 : supports3DStructureLight ? 40 : 10) };

const App: React.FC = () => {
  const hasVault = useHasVault();

  const systemMode = useColorScheme();
  const innerMode = useMode();
  const mode = useMemo(() => (innerMode === 'system' ? (systemMode === 'dark' ? 'dark' : 'light') : innerMode), [innerMode, systemMode]);
  const theme = useMemo(
    () => ({
      mode,
      palette,
      fonts,
      colors: mode === 'dark' ? darkColors : lightColors,
      background: 'blue',
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
          <BottomSheetModalProvider>
            {typeof hasVault === 'boolean' && <Router />}
          </BottomSheetModalProvider>
          <FlashMessage position={messagesTop} MessageComponent={CustomMessage} duration={3000} />
        </NavigationContainer>
      </GestureHandlerRootView>
      <JotaiNexus />
    </>
  );
};

window.onerror = handleError;
function handleError(msg, url, l) {
  let txt = 'There was an error on this page.\n\n';
  txt += 'Error: ' + msg + '\n';
  txt += 'URL: ' + url + '\n';
  txt += 'Line: ' + l + '\n\n';
  txt += 'Click OK to continue.\n\n';
  console.log(txt);
  return true;
}

export default App;
