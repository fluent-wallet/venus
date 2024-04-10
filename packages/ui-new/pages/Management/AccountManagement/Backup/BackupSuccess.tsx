import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, useNavigation, CommonActions } from '@react-navigation/native';
import { Image } from 'expo-image';
import Text from '@components/Text';
import Button from '@components/Button';
import { screenHeight } from '@utils/deviceInfo';
import { BackupStackName, HomeStackName, type StackScreenProps } from '@router/configs';
import Img from '@assets/images/welcome-img.webp';
import BackupBottomSheet from './BackupBottomSheet';
import { useTranslation } from 'react-i18next';

export const BackupSuccessStackName = 'BackupSuccess';

const BackupSuccess: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackScreenProps<typeof BackupStackName>['navigation']>();
  const goHome = useCallback(() => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
  }, [navigation]);

  return (
    <BackupBottomSheet onClose={goHome} snapPoints={snapPoints} showTitle={false}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('backup.success')}</Text>
        <Image style={styles.img} source={Img} contentFit="contain" />

        <Button testID="ok" style={styles.btn} onPress={goHome} size="small">
          {t('common.ok')}
        </Button>
      </View>
    </BackupBottomSheet>
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
  img: {
    alignSelf: 'center',
    width: '60%',
    aspectRatio: 1.285,
    marginTop: 12,
    marginBottom: 'auto',
  },
  btn: {
    marginHorizontal: 16,
  },
});

const snapPoints = [`${((440 / screenHeight) * 100).toFixed(2)}%`];

export default BackupSuccess;
