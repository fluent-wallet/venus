import {
  BottomSheetWrapper,
  BottomSheetScrollContent,
  BottomSheetHeader,
  BottomSheetFooter,
  type BottomSheetMethods,
  InlineBottomSheet,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { screenHeight } from '@utils/deviceInfo';
import type React from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

interface Props {
  onConfirm: () => void;
  onClose: () => void;
  isOpen: boolean;
}

const DeleteConfirm: React.FC<Props> = ({ onConfirm, onClose, isOpen }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

  return (
    <InlineBottomSheet ref={bottomSheetRef} snapPoints={snapPoints} index={isOpen ? 0 : -1} onClose={onClose}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('account.action.remove.title')} />
        <BottomSheetScrollContent>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.action.remove.describe')}</Text>
        </BottomSheetScrollContent>
        <BottomSheetFooter>
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
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </InlineBottomSheet>
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
