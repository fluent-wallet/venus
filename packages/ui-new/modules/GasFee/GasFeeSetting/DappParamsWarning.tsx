import Button from '@components/Button';
import Sheet, { SheetBody, SheetFooter, SheetHeader, SheetScrollView } from '@components/Sheet';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { styles } from './CustomizeGasSetting';

interface Props {
  onPressUse: () => void;
  onClose: () => void;
  isOpen: boolean;
}

const DappParamsWarning: React.FC<Props> = ({ onClose, onPressUse, isOpen }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Sheet isPresented={isOpen} height={{ height: 348 }} containerColor={colors.bgFourth} onDismiss={onClose}>
      <SheetHeader title={t('tx.gasFee.dappParams.title')} />
      <SheetScrollView>
        <SheetBody>
          <Text style={[styles2.text, { color: colors.textPrimary }]}>{t('tx.gasFee.dappParams.description')}</Text>

          <Text style={[styles2.text, { color: colors.textPrimary }]}>
            <Trans i18nKey={'tx.gasFee.dappParams.ask'}>
              Whether to use the <Text style={{ fontWeight: '600' }}>gas parameters</Text> recommended by BIM Wallet Wallet?
            </Trans>
          </Text>
        </SheetBody>
      </SheetScrollView>
      <SheetFooter>
        <View style={[styles.btnArea, styles2.btnArea]}>
          <Button
            testID="cancel"
            style={styles.btn}
            size="small"
            onPress={() => {
              onPressUse();
              onClose();
            }}
          >
            {t('common.use')}
          </Button>
          <Button testID="confirm" style={styles.btn} size="small" onPress={onClose}>
            {t('common.dismiss')}
          </Button>
        </View>
      </SheetFooter>
    </Sheet>
  );
};

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
