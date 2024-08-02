import BottomSheet, { BottomSheetWrapper, BottomSheetHeader, BottomSheetContent, BottomSheetFooter, type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
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
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} index={0} onClose={onClose}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('tx.gasFee.dappParams.title')} />
        <BottomSheetContent>
          <Text style={[styles2.text, { color: colors.textPrimary }]}>{t('tx.gasFee.dappParams.description')}</Text>

          <Text style={[styles2.text, { color: colors.textPrimary }]}>{t('tx.gasFee.dappParams.ask')}</Text>
        </BottomSheetContent>
        <BottomSheetFooter>
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
              {t('common.use')}
            </Button>
            <Button testID="confirm" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()}>
              {t('common.dismiss')}
            </Button>
          </View>
        </BottomSheetFooter>
      </BottomSheetWrapper>
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
    marginBottom: 48,
  },
});

export default DappParamsWarning;
