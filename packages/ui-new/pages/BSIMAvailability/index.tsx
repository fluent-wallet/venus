import { BottomSheetContent, BottomSheetHeader, BottomSheetRoute, BottomSheetWrapper, snapPoints } from '@components/BottomSheet';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text } from 'react-native';
import BSIMNotFindIcon from '@assets/icons/BSIMNotFind.svg';

export const BSIMAvailability = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <BottomSheetRoute snapPoints={snapPoints.percent35}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('bsim.availability.title')} />
        <BottomSheetContent>
          <BSIMNotFindIcon style={styles.banner} />
          <Text style={[styles.description, { color: colors.textPrimary }]}>
            {Platform.OS === 'android' ? t('bsim.availability.androidCardMissing') : t('bsim.availability.iosNoCardBluetooth')}
          </Text>
        </BottomSheetContent>
      </BottomSheetWrapper>
    </BottomSheetRoute>
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
