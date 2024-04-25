import React, { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FlashMessage from 'react-native-flash-message';
import BootSplash from 'react-native-bootsplash';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { JotaiNexus, useHasVault, useCurrentAccount, useCurrentAddressValue } from '@core/WalletCore/Plugins/ReactInject';
import CustomMessage from '@modules/CustomMessage';
import { statusBarHeight, OS, supports3DStructureLight } from './utils/deviceInfo';
import { useMode } from '@hooks/useMode';
import { palette, lightColors, darkColors, fonts } from './theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Router from './router';
import '@assets/i18n';

const messagesTop = { top: statusBarHeight + 20 + (OS === 'android' ? 0 : supports3DStructureLight ? 40 : 10) };

let hasInit = false;
const App: React.FC = () => {
  const hasVault = useHasVault();
  const account = useCurrentAccount();
  const currentAddressValue = useCurrentAddressValue();

  const systemMode = useColorScheme();
  const innerMode = useMode();
  const mode = useMemo(() => (innerMode === 'system' ? (systemMode === 'dark' ? 'dark' : 'light') : innerMode), [innerMode, systemMode]);
  const theme = useMemo(
    () => ({
      mode,
      palette,
      fonts,
      colors: mode === 'dark' ? darkColors : lightColors,
      reverseColors: mode === 'dark' ? lightColors : darkColors,
      background: 'blue',
    }),
    [mode],
  );

  const isReady = hasVault === false || (hasVault === true && !!account?.nickname && !!currentAddressValue);
  useEffect(() => {
    if (hasInit) return;
    if (isReady) {
      hasInit = true;
      BootSplash.hide();
    }
  }, [isReady]);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer theme={theme as unknown as Theme} onReady={BootSplash.hide}>
          <SafeAreaProvider>
            {isReady && <Router />}
            <FlashMessage position={messagesTop} MessageComponent={CustomMessage} duration={3000} />
          </SafeAreaProvider>
        </NavigationContainer>
      </GestureHandlerRootView>
      <JotaiNexus />
    </>
  );
};

export default App;
