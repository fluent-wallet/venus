import React from 'react';
import { useColorScheme } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@rneui/themed';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import database from '@core/DB';
import Router from './router';
import { theme } from './theme';
import './assets/i18n';

const App: React.FC = () => {
  const mode = useColorScheme();
  theme.mode = mode === 'dark' ? 'dark' : 'light';
  return (
    <DatabaseProvider database={database}>
      <ThemeProvider theme={theme}>
        <SafeAreaProvider>
          <Router />
          <FlashMessage position="top" />
        </SafeAreaProvider>
      </ThemeProvider>
    </DatabaseProvider>
  );
};

export default App;
