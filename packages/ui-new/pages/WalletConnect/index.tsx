import PasswordVerify from '@modules/PasswordVerify';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  PasswordVerifyStackName,
  SheetBottomOption,
  type WalletConnectParamList,
  WalletConnectProposalStackName,
  WalletConnectSessionsStackName,
  WalletConnectSignMessageStackName,
  WalletConnectTransactionStackName,
  WalletConnectingStackName,
} from '@router/configs';
import WalletConnecting from './Connecting';
import WalletConnectProposal from './Proposal';
import WalletConnectSessions from './Sessions';
import WalletConnectSignMessage from './SignMessage';
import WalletConnectTransaction from './Transaction';

const WCStack = createNativeStackNavigator<WalletConnectParamList>();

export default function WalletConnect() {
  return (
    <WCStack.Navigator>
      <WCStack.Screen name={WalletConnectingStackName} component={WalletConnecting} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectProposalStackName} component={WalletConnectProposal} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectSessionsStackName} component={WalletConnectSessions} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectSignMessageStackName} component={WalletConnectSignMessage} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectTransactionStackName} component={WalletConnectTransaction} options={SheetBottomOption} />
      <WCStack.Screen name={PasswordVerifyStackName} component={PasswordVerify} options={SheetBottomOption} />
    </WCStack.Navigator>
  );
}
