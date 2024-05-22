import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {NavigationContainer} from '@react-navigation/native';
import Router from './router';

const App: React.FC = () => {
  return (
    <GestureHandlerRootView  style={{ flex: 1 }}>
      <NavigationContainer>
        <Router />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
};

export default App;
