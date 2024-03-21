import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Button from '@components/Button';
import BottomSheet, { BottomSheetMethods, BottomSheetView } from '@components/BottomSheetNew';
import { screenHeight } from '@utils/deviceInfo';

interface Props {
  onConfirm: () => void;
  onClose: () => void;
}

const DeleteConfirm: React.FC<Props> = ({ onConfirm, onClose }) => {
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} index={0} onClose={onClose}>
      <BottomSheetView style={styles.container}>
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
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
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
