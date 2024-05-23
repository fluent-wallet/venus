import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Spinner from '@components/Spinner';
import Plugins from '@core/WalletCore/Plugins';
import { WalletConnectPluginEventMethod } from '@core/WalletCore/Plugins/WalletConnect/types';
import { useNavigation, useTheme } from '@react-navigation/native';
import { StackNavigation } from '@router/configs';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { filter } from 'rxjs';

function WalletConnectLoading() {
  const navigation = useNavigation<StackNavigation>();
  const { colors, reverseColors, mode } = useTheme();
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
      <View style={styles.loading}>
        <Spinner width={50} height={50} color={reverseColors[mode === 'light' ? 'iconPrimary' : 'textSecondary']} backgroundColor={colors.iconPrimary} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
export default WalletConnectLoading;
