import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SendTranscationStackName,
  SendTranscationStep1StackName,
  SendTranscationStep2StackName,
  SendTransactionStep3StackName,
  SendTransactionStep4StackName,
  SendTranscationParamList,
  SheetBottomOption,
  type StackScreenProps,
} from '@router/configs';
import SendTranscationStep1Receiver from './Step1Receiver';
import SendTranscationStep2Asset from './Step2Asset';
import SendTranscationStep3Amount from './Step3Amount';
import SendTranscationStep4Confirm from './Step4Confirm';

const SendTranscationStack = createNativeStackNavigator<SendTranscationParamList>();

const Backup: React.FC<StackScreenProps<typeof SendTranscationStackName>> = () => {
  return (
    <SendTranscationStack.Navigator>
      <SendTranscationStack.Screen name={SendTranscationStep1StackName} component={SendTranscationStep1Receiver} options={SheetBottomOption} />
      <SendTranscationStack.Screen name={SendTranscationStep2StackName} component={SendTranscationStep2Asset} options={SheetBottomOption} />
      <SendTranscationStack.Screen name={SendTransactionStep3StackName} component={SendTranscationStep3Amount} options={SheetBottomOption} />
      <SendTranscationStack.Screen name={SendTransactionStep4StackName} component={SendTranscationStep4Confirm} options={SheetBottomOption} />
    </SendTranscationStack.Navigator>
  );
};

export default Backup;
