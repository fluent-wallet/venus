import React from 'react';
import { useColorScheme } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@rneui/themed';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import database from '@DB/index';
import Router from './router';
import { theme } from './theme';
import './assets/i18n';

const App: React.FC = () => {
  const mode = useColorScheme();
  theme.mode = mode === 'dark' ? 'dark' : 'light';
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider database={database}>
        <ThemeProvider theme={theme}>
          <SafeAreaProvider>
            <Router />
            <FlashMessage position="top" />
          </SafeAreaProvider>
        </ThemeProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
};

export default App;
