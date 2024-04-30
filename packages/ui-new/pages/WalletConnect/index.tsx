import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WalletConnectLoading from './loading';
import {
  WalletConnectLoadingStackName,
  WalletConnectParamList,
  SheetBottomOption,
  WalletConnectProposalStackName,
  WalletConnectSessionsStackName,
} from '@router/configs';
import WalletConnectProposal from './proposal';
import WalletConnectSessions from './sessions';

const WCStack = createNativeStackNavigator<WalletConnectParamList>();

export default function WalletConnect() {
  return (
    <WCStack.Navigator>
      <WCStack.Screen name={WalletConnectLoadingStackName} component={WalletConnectLoading} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectProposalStackName} component={WalletConnectProposal} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectSessionsStackName} component={WalletConnectSessions} options={SheetBottomOption} />
    </WCStack.Navigator>
  );
}
