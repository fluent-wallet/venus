import React from 'react';
import { useColorScheme } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@rneui/themed';
import { useHasVault } from '@core/WalletCore/Plugins/ReactInject';
import PasswordVerify from '@modules/PasswordVerify';
import RequestHandler from '@modules/RequestHandler';
import CustomMessage from '@components/CustomMessage';
import Router from './router';
import { theme } from './theme';
import './assets/i18n';

const App: React.FC = () => {
  const mode = useColorScheme();
  // theme.mode = mode === 'dark' ? 'dark' : 'light';
  theme.mode = 'light'
  const hasVault = useHasVault();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider theme={theme}>
        <SafeAreaProvider>
          {typeof hasVault === 'boolean' && <Router />}
          <PasswordVerify />
          <RequestHandler /> 
          <FlashMessage position="bottom" MessageComponent={CustomMessage} duration={1500} animated={false} />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default App;
