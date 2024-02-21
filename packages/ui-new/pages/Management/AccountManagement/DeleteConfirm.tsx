import React, { type MutableRefObject } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Button from '@components/Button';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { screenHeight } from '@utils/deviceInfo';
import { AccountSettingStackName, GroupSettingStackName, type StackScreenProps } from '@router/configs';

interface Props {
  navigation: StackScreenProps<typeof AccountSettingStackName | typeof GroupSettingStackName>['navigation'];
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
  onConfirm: () => void;
}

const DeleteConfirm: React.FC<Props> = ({ bottomSheetRef, onConfirm }) => {
  const { colors } = useTheme();

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} isModal={false}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>⚠️ Confirm to delete{'\n'}this wallet?</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          This Action will remove this wallet from the app.{'\n'}
          {'\n'}
          App can not restore your wallet, you can restore with its seed phrase / private key.{'\n'}
          {'\n'}
          Be sure to back up your wallet, otherwise you will permanently lose it and all assets.
        </Text>

        <View style={styles.btnArea}>
          <Button style={styles.btn} onPress={() => bottomSheetRef.current?.close()}>
            Cancel
          </Button>
          <Button
            style={[styles.btn, { backgroundColor: colors.down }]}
            onPress={() => {
              bottomSheetRef.current?.close();
              onConfirm();
            }}
          >
            ⚠️ Delete
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
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
    marginTop: 'auto',
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

const snapPoints = [`${((400 / screenHeight) * 100).toFixed(2)}%`];

export default DeleteConfirm;
