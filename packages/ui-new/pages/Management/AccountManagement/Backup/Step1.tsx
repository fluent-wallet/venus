import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import { isSmallDevice } from '@utils/deviceInfo';
import Img from '@assets/images/welcome-img.webp';
import BackupBottomSheet from './BackupBottomSheet';
import { BackupScreenProps, BackupStep2StackName } from '@router/configs';

export const BackupStep1StackName = 'BackupStep1';

const BackupStep1: React.FC<BackupScreenProps<typeof BackupStep1StackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();

  return (
    <BackupBottomSheet onClose={navigation.goBack}>
      <Image style={styles.img} source={Img} contentFit="contain" />
      <Text style={[styles.notice, { color: colors.textPrimary }]}>📢 Notice</Text>
      <Text style={[styles.description, { color: colors.textPrimary }]}>
        If you lose your <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>seed phrase</Text> or{' '}
        <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>private key</Text>, you won’t be able to recover you wallet.
        {'\n'}
        {'\n'}
        btaining <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>seed phrase</Text> or{' '}
        <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>private key</Text> means owning all assets.
        {'\n'}
        {'\n'}
        Please <Text style={[styles.descriptionBold, { color: colors.textNotice }]}>protect</Text> them carefully
      </Text>

      <Button style={styles.btn} mode="auto" onPress={() => navigation.navigate(BackupStep2StackName, route.params)}>
        Next
      </Button>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  notice: {
    marginTop: isSmallDevice ? 20 : 40,
    marginBottom: 24,
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
  img: {
    alignSelf: 'center',
    width: '85%',
    aspectRatio: 1.285,
    marginTop: 6,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default BackupStep1;
