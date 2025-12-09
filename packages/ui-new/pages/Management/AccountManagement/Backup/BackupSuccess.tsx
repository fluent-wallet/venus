import Congratulate from '@assets/images/congratulate.webp';
import { BottomSheetContent, BottomSheetFooter } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { BackupStackName, StackScreenProps } from '@router/configs';
import backToHome from '@utils/backToHome';
import { screenHeight } from '@utils/deviceInfo';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import BackupBottomSheet from './BackupBottomSheet';

export const BackupSuccessStackName = 'BackupSuccess';

const BackupSuccess: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackScreenProps<typeof BackupStackName>['navigation']>();
  const goHome = useCallback(() => {
    backToHome(navigation);
  }, [navigation]);

  return (
    <BackupBottomSheet onClose={goHome} snapPoints={snapPoints} showTitle={false}>
      <BottomSheetContent>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('backup.success')}</Text>
        <Image style={styles.img} source={Congratulate} contentFit="contain" />
      </BottomSheetContent>
      <BottomSheetFooter>
        <Button testID="ok" onPress={goHome} size="small">
          {t('common.ok')}
        </Button>
      </BottomSheetFooter>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
  },
  img: {
    alignSelf: 'center',
    width: 100,
    aspectRatio: 1,
    marginTop: 24,
    marginBottom: 'auto',
  },
});

const snapPoints = [`${((300 / screenHeight) * 100).toFixed(2)}%`];

export default BackupSuccess;
