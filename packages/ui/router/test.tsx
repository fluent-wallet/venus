import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Welcome, { WelcomeStackName } from '@pages/Welcome';

const Stack = createNativeStackNavigator();

const StackNavigator = () => {
  return (
    <Stack.Navigator initialRouteName={WelcomeStackName}>
      <Stack.Screen name={WelcomeStackName} component={Welcome} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

const Router: React.FC = () => {
  return (
    <NavigationContainer>
      <StackNavigator />
    </NavigationContainer>
  );
};

export default Router;
