import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Text from '@components/Text';
import BottomSheet, { snapPoints } from '@components/BottomSheet';

import {
  BackupStackName,
  type StackScreenProps,
  BackupStep1StackName,
  BackupStep2StackName,
  BackupStep3StackName,
  BackupSuccessStackName,
  BackupStackParamList,
  SheetBottomOption,
} from '@router/configs';
import BackupStep1 from './Step1';
import BackupStep2 from './Step2';
import BackupStep3 from './Step3';
import BackupSuccess from './BackupSuccess';

const BackupStack = createNativeStackNavigator<BackupStackParamList>();

const Backup: React.FC<StackScreenProps<typeof BackupStackName>> = (props) => {
  return (
    <BackupStack.Navigator>
      <BackupStack.Screen name={BackupStep1StackName} component={BackupStep1} options={SheetBottomOption} />
      <BackupStack.Screen name={BackupStep2StackName} component={BackupStep2} options={SheetBottomOption} />
      <BackupStack.Screen name={BackupStep3StackName} component={BackupStep3} options={SheetBottomOption} />
      <BackupStack.Screen name={BackupSuccessStackName} component={BackupSuccess} options={SheetBottomOption} />
    </BackupStack.Navigator>
  );
};

export default Backup;
