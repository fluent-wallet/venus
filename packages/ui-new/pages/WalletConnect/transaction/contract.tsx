import BottomSheet, { snapPoints } from '@components/BottomSheet';
import { View } from 'react-native';

function WalletConnectTransactionContract() {
  return (
    <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.percent75}>
      <View></View>
    </BottomSheet>
  );
}

export default WalletConnectTransactionContract