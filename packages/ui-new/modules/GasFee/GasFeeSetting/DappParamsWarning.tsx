import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import { styles } from './CustomizeGasSetting';

interface Props {
  onPressUse: () => void;
  onClose: () => void;
}

const DappParamsWarning: React.FC<Props> = ({ onClose, onPressUse }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} style={styles.container} index={0} onClose={onClose}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Tips</Text>
      <Text style={[styles2.text, { color: colors.textPrimary }]}>The gas parameters used by the DApp may cause the transaction to fail.</Text>

      <Text style={[styles2.text, { color: colors.textPrimary }]}>
        Whether to use the <Text style={{ color: colors.up, fontWeight: '600' }}>gas parameters</Text> recommended by SwiftShield Wallet?
      </Text>

      <View style={[styles.btnArea, styles2.btnArea]}>
        <Button
          testID="cancel"
          style={styles.btn}
          size="small"
          onPress={() => {
            onPressUse();
            bottomSheetRef.current?.close();
          }}
        >
          Use
        </Button>
        <Button testID="confirm" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()}>
          Dismiss
        </Button>
      </View>
    </BottomSheet>
  );
};

const snapPoints = [348];

const styles2 = StyleSheet.create({
  text: {
    marginTop: 16,
    fontWeight: '300',
    fontSize: 16,
    lineHeight: 20,
  },
  btnArea: {
    marginTop: 'auto',
    marginBottom: 48,
  },
});

export default DappParamsWarning;
