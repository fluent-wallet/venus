import React from 'react';
import { useColorScheme } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@rneui/themed';
import { useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import PasswordValidate from '@modules/PasswordValidate';
import Router from './router';
import { theme } from './theme';
import './assets/i18n';

const App: React.FC = () => {
  const mode = useColorScheme();
  theme.mode = mode === 'dark' ? 'dark' : 'light';
  const hasVault = useHasVault();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider theme={theme}>
        <SafeAreaProvider>
          {typeof hasVault === 'boolean' && <Router />}
          {/* <PasswordValidate /> */}
          <FlashMessage position="top" />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default App;
