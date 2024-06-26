import PasswordVerify from '@modules/PasswordVerify';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  type BackupStackName,
  type BackupStackParamList,
  BackupStep1StackName,
  BackupStep2StackName,
  BackupStep3StackName,
  BackupSuccessStackName,
  PasswordVerifyStackName,
  SheetBottomOption,
  type StackScreenProps,
} from '@router/configs';
import type React from 'react';
import BackupSuccess from './BackupSuccess';
import BackupStep1Notice from './Step1Notice';
import BackupStep2ViewSecret from './Step2ViewSecret';
import BackupStep3RandomCheck from './Step3RandomCheck';

const BackupStack = createNativeStackNavigator<BackupStackParamList>();

const Backup: React.FC<StackScreenProps<typeof BackupStackName>> = () => {
  return (
    <BackupStack.Navigator>
      <BackupStack.Screen name={BackupStep1StackName} component={BackupStep1Notice} options={SheetBottomOption} />
      <BackupStack.Screen name={BackupStep2StackName} component={BackupStep2ViewSecret} options={SheetBottomOption} />
      <BackupStack.Screen name={BackupStep3StackName} component={BackupStep3RandomCheck} options={SheetBottomOption} />
      <BackupStack.Screen name={BackupSuccessStackName} component={BackupSuccess} options={SheetBottomOption} />
      <BackupStack.Screen name={PasswordVerifyStackName} component={PasswordVerify} options={SheetBottomOption} />
    </BackupStack.Navigator>
  );
};

export default Backup;
