import React from 'react';
import {View} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Home from '../pages/Home';
import A from '../pages/A';
import B from '../pages/B';
import C from '../pages/C';
import {
  AStackName,
  BStackName,
  CStackName,
  HomeStackName,
  type RootStackParamList,
  SheetBottomOption,
} from './configs';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const screenOptions = {
  orientation: 'portrait',
  headerBackVisible: false,
  statusBarTranslucent: true,
  statusBarBackgroundColor: 'transparent',
} as const;

const Router: React.FC = () => {
  return (
    <View style={{flex: 1}}>
      <RootStack.Navigator
        initialRouteName={HomeStackName}
        screenOptions={screenOptions}>
        <RootStack.Screen
          name={HomeStackName}
          component={Home}
          options={SheetBottomOption}
        />
        <RootStack.Screen
          name={AStackName}
          component={A}
          options={SheetBottomOption}
        />
        <RootStack.Screen
          name={BStackName}
          component={B}
          options={SheetBottomOption}
        />
        <RootStack.Screen
          name={CStackName}
          component={C}
          options={SheetBottomOption}
        />
      </RootStack.Navigator>
    </View>
  );
};

export default Router;
