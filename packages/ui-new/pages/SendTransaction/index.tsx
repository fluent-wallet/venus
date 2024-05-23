import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SendTransactionStackName,
  SendTransactionStep1StackName,
  SendTransactionStep2StackName,
  SendTransactionStep3StackName,
  SendTransactionStep4StackName,
  SendTransactionParamList,
  SheetBottomOption,
  PasswordVerifyStackName,
  type StackScreenProps,
} from '@router/configs';
import PasswordVerify from '@modules/PasswordVerify';
import SendTransactionStep1Receiver from './Step1Receiver';
import SendTransactionStep2Asset from './Step2Asset';
import SendTransactionStep3Amount from './Step3Amount';
import SendTransactionStep4Confirm from './Step4Confirm';

const SendTransactionStack = createNativeStackNavigator<SendTransactionParamList>();

const SendTransaction: React.FC<StackScreenProps<typeof SendTransactionStackName>> = () => {
  return (
    <SendTransactionStack.Navigator>
      <SendTransactionStack.Screen name={SendTransactionStep1StackName} component={SendTransactionStep1Receiver} options={SheetBottomOption} />
      <SendTransactionStack.Screen name={SendTransactionStep2StackName} component={SendTransactionStep2Asset} options={SheetBottomOption} />
      <SendTransactionStack.Screen name={SendTransactionStep3StackName} component={SendTransactionStep3Amount} options={SheetBottomOption} />
      <SendTransactionStack.Screen name={SendTransactionStep4StackName} component={SendTransactionStep4Confirm} options={SheetBottomOption} />
      <SendTransactionStack.Screen name={PasswordVerifyStackName} component={PasswordVerify} options={SheetBottomOption} />
    </SendTransactionStack.Navigator>
  );
};

export default SendTransaction;
