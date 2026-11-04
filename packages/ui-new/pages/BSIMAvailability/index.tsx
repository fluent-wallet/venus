import BSIMNotFindIcon from '@assets/icons/BSIMNotFind.svg';
import { SheetBody, SheetHeader } from '@components/Sheet';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text } from 'react-native';

export const BSIMAvailability = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <SheetHeader title={t('bsim.availability.title')} />
      <SheetBody>
        <BSIMNotFindIcon style={styles.banner} />
        <Text style={[styles.description, { color: colors.textPrimary }]}>
          {Platform.OS === 'android' ? t('bsim.availability.androidCardMissing') : t('bsim.availability.iosNoCardBluetooth')}
        </Text>
      </SheetBody>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    width: 361,
    height: 156,
    alignSelf: 'center',
    marginTop: 24,
  },
  description: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '300',
  },
});
