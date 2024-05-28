import BottomSheet, { snapPoints} from '@components/BottomSheet';
import Spinner from '@components/Spinner';
import { useTheme } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

function WalletConnectLoading() {
  const { colors, reverseColors, mode } = useTheme();

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
