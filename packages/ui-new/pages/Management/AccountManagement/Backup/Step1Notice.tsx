import Img from '@assets/images/backup.webp';
import Button from '@components/Button';
import { SheetBody, SheetFooter, SheetHeader, SheetScrollView } from '@components/Sheet';
import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { type BackupStep1StackName, BackupStep2StackName, type StackScreenProps } from '@router/configs';
import { isSmallDevice } from '@utils/deviceInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

const BackupStep1Notice: React.FC<StackScreenProps<typeof BackupStep1StackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View collapsable={false} style={styles.container}>
      <SheetHeader title={t('backup.title')} />
      <SheetScrollView>
        <SheetBody>
          <Image style={styles.img} source={Img} contentFit="contain" />
          <Text style={[styles.notice, { color: colors.textPrimary }]}>{t('backup.notice.title')}</Text>
          <Text style={[styles.description, { color: colors.textPrimary }]}>
            <Trans i18nKey={'backup.notice.describe'}>
              If you lose your <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>seed phrase</Text> or
              <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>private key</Text>, you won’t be able to recover you wallet. Obtaining
              <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>seed phrase</Text> or
              <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>private key</Text> means owning all assets. Please
              <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>protect</Text> them carefully
            </Trans>
          </Text>
        </SheetBody>
      </SheetScrollView>
      <SheetFooter>
        <Button testID="next" onPress={() => navigation.navigate(BackupStep2StackName, route.params)} size="small">
          {t('common.next')}
        </Button>
      </SheetFooter>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  img: {
    alignSelf: 'center',
    width: 260,
    aspectRatio: 1,
    marginTop: isSmallDevice ? 16 : 20,
  },
  notice: {
    marginTop: isSmallDevice ? 18 : 40,
    marginBottom: isSmallDevice ? 14 : 24,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  description: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  descriptionBold: {
    fontWeight: '600',
  },
});

export default BackupStep1Notice;
