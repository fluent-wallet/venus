import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Plugins from '@core/WalletCore/Plugins';
import { useNavigation } from '@react-navigation/native';
import { StackNavigation } from '@router/configs';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

function WalletConnectLoading() {
  const navigation = useNavigation<StackNavigation>();
  useEffect(() => {
    const sub = Plugins.WalletConnect.subscribeLoading()
      .subscribe(() => {
        navigation.goBack();
      });
    return () => {
      sub.unsubscribe();
    };
  }, []);

  return (
    <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.percent75}>
      <View>
        <Text>Loading</Text>
      </View>
    </BottomSheet>
  );
}

export default WalletConnectLoading;
