import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import { isSmallDevice } from '@utils/deviceInfo';
// import Img from '@assets/images/welcome-img.webp';
import Img from '@assets/images/backup.webp';
import BackupBottomSheet from './BackupBottomSheet';
import { BackupStep1StackName, BackupStep2StackName, type BackupScreenProps } from '@router/configs';
import { Trans, useTranslation } from 'react-i18next';

const BackupStep1Notice: React.FC<BackupScreenProps<typeof BackupStep1StackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <BackupBottomSheet>
      <Image style={styles.img} source={Img} contentFit="contain" />
      <Text style={[styles.notice, { color: colors.textPrimary }]}>Notice</Text>
      <Text style={[styles.description, { color: colors.textPrimary }]}>
        <Trans i18nKey={'backup.notice.describe'}>
          If you lose your <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>seed phrase</Text> or
          <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>private key</Text>, you won’t be able to recover you wallet. Obtaining{' '}
          <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>seed phrase</Text> or
          <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>private key</Text> means owning all assets. Please{' '}
          <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>protect</Text> them carefully
        </Trans>
      </Text>

      <Button testID="next" style={styles.btn} onPress={() => navigation.navigate(BackupStep2StackName, route.params)} size="small">
        {t('common.next')}
      </Button>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  img: {
    alignSelf: 'center',
    width: isSmallDevice ? '80%' : '85%',
    aspectRatio: 1.285,
    marginTop: 6,
  },
  notice: {
    marginTop: isSmallDevice ? 20 : 40,
    marginBottom: isSmallDevice ? 16 : 24,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  description: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  descriptionBold: {
    fontWeight: '600',
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default BackupStep1Notice;
