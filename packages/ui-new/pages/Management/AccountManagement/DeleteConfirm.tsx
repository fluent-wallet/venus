import Button from '@components/Button';
import Sheet, { SheetBody, SheetFooter, SheetHeader, SheetScrollView } from '@components/Sheet';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
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

  return (
    <Sheet isPresented={isOpen} height={{ height: 400 }} containerColor={colors.bgFourth} onDismiss={onClose}>
      <SheetHeader title={t('account.action.remove.title')} />
      <SheetScrollView>
        <SheetBody>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('account.action.remove.describe')}</Text>
        </SheetBody>
      </SheetScrollView>
      <SheetFooter>
        <View style={styles.btnArea}>
          <Button testID="cancel" style={styles.btn} size="small" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            testID="delete"
            style={[styles.btn, { backgroundColor: colors.down }]}
            textColor="#fff"
            size="small"
            onPress={() => {
              onClose();
              onConfirm();
            }}
          >
            {t('common.delete')}
          </Button>
        </View>
      </SheetFooter>
    </Sheet>
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

export default DeleteConfirm;
