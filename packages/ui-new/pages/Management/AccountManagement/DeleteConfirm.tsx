import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Button from '@components/Button';
import BottomSheet, { BottomSheetMethods } from '@components/BottomSheet';
import { screenHeight } from '@utils/deviceInfo';
import { useTranslation } from 'react-i18next';

interface Props {
  onConfirm: () => void;
  onClose: () => void;
}

const DeleteConfirm: React.FC<Props> = ({ onConfirm, onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} index={0} onClose={onClose}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('account.action.remove.title')}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.action.remove.describe')}</Text>

        <View style={styles.btnArea}>
          <Button testID="cancel" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()}>
            {t('common.cancel')}
          </Button>
          <Button
            testID="delete"
            style={[styles.btn, { backgroundColor: colors.down }]}
            textColor="#fff"
            size="small"
            onPress={() => {
              bottomSheetRef.current?.close();
              onConfirm();
            }}
          >
            {t('common.delete')}
          </Button>
        </View>
      </View>
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
