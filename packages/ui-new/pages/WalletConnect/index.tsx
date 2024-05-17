import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WalletConnectLoading from './loading';
import {
  WalletConnectLoadingStackName,
  WalletConnectParamList,
  SheetBottomOption,
  WalletConnectProposalStackName,
  WalletConnectSessionsStackName,
  WalletConnectSignMessageStackName,
  WalletConnectTransactionStackName,

} from '@router/configs';
import WalletConnectProposal from './proposal';
import WalletConnectSessions from './sessions';
import WalletConnectSignMessage from './signMessage';
import WalletConnectTransaction from './transaction';

const WCStack = createNativeStackNavigator<WalletConnectParamList>();

export default function WalletConnect() {
  return (
    <WCStack.Navigator>
      <WCStack.Screen name={WalletConnectLoadingStackName} component={WalletConnectLoading} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectProposalStackName} component={WalletConnectProposal} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectSessionsStackName} component={WalletConnectSessions} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectSignMessageStackName} component={WalletConnectSignMessage} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectTransactionStackName} component={WalletConnectTransaction} options={SheetBottomOption} />
    </WCStack.Navigator>
  );
}
