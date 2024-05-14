import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Plugins from '@core/WalletCore/Plugins';
import { WalletConnectPluginEventMethod } from '@core/WalletCore/Plugins/WalletConnect/types';
import { useNavigation } from '@react-navigation/native';
import { StackNavigation } from '@router/configs';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { filter } from 'rxjs';

function WalletConnectLoading() {
  const navigation = useNavigation<StackNavigation>();
  useEffect(() => {
    const sub = Plugins.WalletConnect.events.pipe(filter((event) => event.type === WalletConnectPluginEventMethod.LOADING)).subscribe((event) => {
      if (event.data === false) {
        navigation.goBack();
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, [navigation]);

  return (
    <BottomSheet enablePanDownToClose={false} isRoute snapPoints={snapPoints.percent75}>
      <View>
        <Text>Loading</Text>
      </View>
    </BottomSheet>
  );
}

export default WalletConnectLoading;
