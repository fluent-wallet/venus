import React, { useCallback, type MutableRefObject } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import RNRestart from 'react-native-restart';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import Text from '@components/Text';
import Button from '@components/Button';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { AccountManagementStackName, WelcomeStackName, type StackScreenProps } from '@router/configs';

interface Props {
  navigation: StackScreenProps<typeof AccountManagementStackName>['navigation'];
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
}

const EraseAllWallet: React.FC<Props> = ({ navigation, bottomSheetRef }) => {
  const { colors } = useTheme();

  const handleDelete = useCallback(async () => {
    try {
      await plugins.Authentication.getPassword();
      navigation.navigate(WelcomeStackName);
      bottomSheetRef.current.dismiss();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await methods.clearAccountData();
      await RNRestart.restart();
      // showMessage({
      //   message: 'Clear account data successfully',
      //   type: 'success',
      // });
    } catch (err) {
      if (String(err)?.includes('cancel')) {
        return;
      }
      showMessage({
        message: 'Clear account data failed',
        description: String(err ?? ''),
        type: 'warning',
      });
    }
  }, []);

  return (
    <>
      <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>⚠️ Confirm to delete{'\n'}this wallet?</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            This Action will remove this wallet form the app.{'\n'}
            {'\n'}
            App can not restore your wallet, you can restore with its seed phrase / private key.{'\n'}
            {'\n'}
            Be sure to back up your wallet, otherwise you will permanently lose it and all assets.
          </Text>

          <View style={styles.btnArea}>
            <Button style={styles.btn} onPress={() => bottomSheetRef.current?.close()}>
              Cancel
            </Button>
            <Button style={[styles.btn, { backgroundColor: colors.down }]} onPress={handleDelete}>
              ⚠️ Delete
            </Button>
          </View>
        </View>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
  },
  description: {
    marginTop: 16,
    marginBottom: 32,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

const snapPoints = ['50%'];

export default EraseAllWallet;
