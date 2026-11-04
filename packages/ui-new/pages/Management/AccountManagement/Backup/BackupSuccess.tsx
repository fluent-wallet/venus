import Congratulate from '@assets/images/congratulate.webp';
import Button from '@components/Button';
import { SheetBody, SheetFooter, SheetHandle } from '@components/Sheet';
import Text from '@components/Text';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { BackupSuccessStackName, StackScreenProps } from '@router/configs';
import backToHome from '@utils/backToHome';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

const BackupSuccess: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<StackScreenProps<typeof BackupSuccessStackName>['navigation']>();
  const goHome = useCallback(() => {
    backToHome(navigation);
  }, [navigation]);

  // Dismissing the success sheet ends the backup flow.
  useEffect(() => goHome, [goHome]);

  return (
    <View collapsable={false} style={styles.container}>
      <SheetHandle />
      <SheetBody>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('backup.success')}</Text>
        <Image style={styles.img} source={Congratulate} contentFit="contain" />
      </SheetBody>
      <SheetFooter>
        <Button testID="ok" onPress={goHome} size="small">
          {t('common.ok')}
        </Button>
      </SheetFooter>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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

export default BackupSuccess;
