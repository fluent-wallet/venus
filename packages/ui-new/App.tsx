import { JotaiNexus, useCurrentAccount, useCurrentAddressValue, useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import events, { LifeCycle } from '@core/WalletCore/Events';
import { useMode } from '@hooks/useMode';
import CustomMessage from '@modules/CustomMessage';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import type React from 'react';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Router from './router';
import { darkColors, fonts, lightColors, palette } from './theme';
import { OS, statusBarHeight, supports3DStructureLight } from './utils/deviceInfo';
import '@assets/i18n';

const messagesTop = { top: statusBarHeight + 20 + (OS === 'android' ? 0 : supports3DStructureLight ? 40 : 10) };

const App: React.FC = () => {
  const hasVault = useHasVault();
  const account = useCurrentAccount();
  const currentAddressValue = useCurrentAddressValue();
  const lifeCycle = events.useLifeCycle();

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

  const isReady = (hasVault === false || (hasVault === true && !!account?.nickname && !!currentAddressValue)) && lifeCycle === LifeCycle.Ready;

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
