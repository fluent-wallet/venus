import PasswordVerify from '@modules/PasswordVerify';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  PasswordVerifyStackName,
  type SendTransactionParamList,
  type SendTransactionStackName,
  SendTransactionStep1StackName,
  SendTransactionStep2StackName,
  SendTransactionStep3StackName,
  SendTransactionStep4StackName,
  SheetBottomOption,
  type StackScreenProps,
} from '@router/configs';
import type React from 'react';
import { buildInitialSendFlowStateFromEntry, SendFlowProvider, type SendFlowStep } from './flow';
import SendTransactionStep1Receiver from './Step1Receiver';
import SendTransactionStep2Asset from './Step2Asset';
import SendTransactionStep3Amount from './Step3Amount';
import SendTransactionStep4Confirm from './Step4Confirm';

const SendTransactionStack = createNativeStackNavigator<SendTransactionParamList>();

const routeNameByStep: Record<SendFlowStep, keyof SendTransactionParamList> = {
  recipient: SendTransactionStep1StackName,
  asset: SendTransactionStep2StackName,
  amount: SendTransactionStep3StackName,
  review: SendTransactionStep4StackName,
};

const SendTransaction: React.FC<StackScreenProps<typeof SendTransactionStackName>> = ({ route }) => {
  const initialState = buildInitialSendFlowStateFromEntry(route.params.entry);

  return (
    <SendFlowProvider initialState={initialState}>
      <SendTransactionStack.Navigator initialRouteName={routeNameByStep[initialState.initialStep]}>
        <SendTransactionStack.Screen name={SendTransactionStep1StackName} component={SendTransactionStep1Receiver} options={SheetBottomOption} />
        <SendTransactionStack.Screen name={SendTransactionStep2StackName} component={SendTransactionStep2Asset} options={SheetBottomOption} />
        <SendTransactionStack.Screen name={SendTransactionStep3StackName} component={SendTransactionStep3Amount} options={SheetBottomOption} />
        <SendTransactionStack.Screen name={SendTransactionStep4StackName} component={SendTransactionStep4Confirm} options={SheetBottomOption} />
        <SendTransactionStack.Screen name={PasswordVerifyStackName} component={PasswordVerify} options={SheetBottomOption} />
      </SendTransactionStack.Navigator>
    </SendFlowProvider>
  );
};

export default SendTransaction;
