import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WalletConnectLoading from './loading';
import { WalletConnectLoadingStackName, WalletConnectParamList, SheetBottomOption, WalletConnectProposalStackName } from '@router/configs';
import WalletConnectProposal from './proposal';

const WCStack = createNativeStackNavigator<WalletConnectParamList>();

export default function WalletConnect() {
  return (
    <WCStack.Navigator>
      <WCStack.Screen name={WalletConnectLoadingStackName} component={WalletConnectLoading} options={SheetBottomOption} />
      <WCStack.Screen name={WalletConnectProposalStackName} component={WalletConnectProposal} options={SheetBottomOption} />
    </WCStack.Navigator>
  );
}
