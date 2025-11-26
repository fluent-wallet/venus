import { useTheme } from '@react-navigation/native';
import { Trans, useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import RecoverBSIMImg from '@assets/images/recoverBSIM.svg';
import WarnIcon from '@assets/icons/warn.svg';
import Button from '@components/Button';

export const RecoverBSIM = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {t('initWallet.recoverBSIM.title')}
      </Text>

      <RecoverBSIMImg style={styles.img} />

      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('initWallet.recoverBSIM.title')}</Text>

      <Text style={[styles.description, { color: colors.textPrimary }]}>
        <Trans i18nKey={'initWallet.recoverBSIM.describe.part1'}>
          This operation will restore your wallet to this BSIM card using your backup
          <Text style={[styles.highlight, { color: colors.textNotice }]}>QR code</Text> and
          <Text style={[styles.highlight, { color: colors.textNotice }]}>backup password</Text>.
        </Trans>
      </Text>

      <Text style={[styles.description, { color: colors.textPrimary }]}>
        <Trans i18nKey={'initWallet.recoverBSIM.describe.part2'}>
          Please make sure your new BSIM card is properly inserted. Ensure that both your QR code and backup password are
          <Text style={[styles.highlight, { color: colors.textNotice }]}>correct</Text>.
        </Trans>
      </Text>

      <View style={styles.warn}>
        <WarnIcon color={colors.middle} />
        <Text style={[styles.warningText, { color: colors.textNotice }]}>{t('initWallet.recoverBSIM.warning')}</Text>
      </View>

      <Button>{t('common.next')}</Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'left',
  },
  img: {
    width: 240,
    aspectRatio: 1,
    alignSelf: 'center',
  },
  description: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '300',
  },
  highlight: {
    fontWeight: '600',
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 26,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 16,
  },
});
