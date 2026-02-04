import { useCurrentAccount, useCurrentAddressValue, useHasVault, useVaultOfAccount, VaultType } from '@core/WalletCore/Plugins/ReactInject';
import { useMode } from '@hooks/useMode';
import CustomMessage from '@modules/CustomMessage';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import Router from './router';
import { darkColors, fonts, lightColors, palette } from './theme';
import { OS, statusBarHeight, supports3DStructureLight } from './utils/deviceInfo';
import '@assets/i18n';
import Plugins from '@core/WalletCore/Plugins';

const messagesTop = { top: statusBarHeight + 20 + (OS === 'android' ? 0 : supports3DStructureLight ? 40 : 10) };

const App: React.FC = () => {
  const hasVault = useHasVault();
  const account = useCurrentAccount();
  const currentAddressValue = useCurrentAddressValue();

  const currentVault = useVaultOfAccount(account?.id);
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

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (currentVault?.type !== VaultType.BSIM) return;

    const deviceId = currentVault.hardwareDeviceId ?? undefined;
    if (!deviceId) return;

    Plugins.BSIM.setBleDeviceId(deviceId);
  }, [currentVault?.hardwareDeviceId, currentVault?.type]);

  const Message = useMemo(
    () =>
      Platform.OS === 'ios' ? (
        <FullWindowOverlay>
          <FlashMessage position={messagesTop} MessageComponent={CustomMessage} duration={3000} />
        </FullWindowOverlay>
      ) : (
        <FlashMessage position={messagesTop} MessageComponent={CustomMessage} duration={3000} />
      ),
    [],
  );
  const isReady = hasVault === false || (hasVault === true && !!account?.nickname && !!currentAddressValue);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer theme={theme as unknown as Theme} onReady={BootSplash.hide}>
          <SafeAreaProvider>
            {isReady && <Router />}
            {Message}
          </SafeAreaProvider>
        </NavigationContainer>
      </GestureHandlerRootView>
    </>
  );
};

export default App;
