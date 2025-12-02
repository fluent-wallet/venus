import BSIM from '@WalletCoreExtends/Plugins/BSIM';
import SecurityNoticeImg from '@assets/images/securityNotice.webp';
import Button from '@components/Button';
import { useTheme } from '@react-navigation/native';
import { BiometricsWayStackName, type ChangeBPinStackName, type StackScreenProps } from '@router/configs';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import { Image } from 'expo-image';
import { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export const ChangeBPin: React.FC<StackScreenProps<typeof ChangeBPinStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const handleChange = useCallback(async () => {
    try {
      await BSIM.updateBPIN();
      navigation.navigate(BiometricsWayStackName, { type: 'connectBSIM' });
    } catch (error) {
      if (handleBSIMHardwareUnavailable(error, navigation)) {
        return;
      }
      throw error;
    }
  }, [navigation]);
  const handleSkip = useCallback(() => {
    navigation.navigate(BiometricsWayStackName, { type: 'connectBSIM' });
  }, [navigation]);
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {t('initWallet.changeBPin.title')}
      </Text>
      <Image source={SecurityNoticeImg} style={styles.img} contentFit="contain" />

      <Text style={[styles.description, { color: colors.textPrimary }]}>
        <Trans i18nKey={'initWallet.changeBPin.describe'}>
          This BSIM card is using the default PIN. For your asset security, you
          <Text style={{ color: colors.textNotice, fontWeight: '600' }}>must set a new BPIN</Text> before using the wallet.
        </Trans>
      </Text>
      <Button testID="changeBpin" style={styles.btn} onPress={handleChange}>
        {t('initWallet.changeBPin.button')}
      </Button>

      <Pressable style={({ pressed }) => [styles.skip, { backgroundColor: pressed ? colors.underlay : 'transparent' }]} testID="skip" onPress={handleSkip}>
        <Text style={[styles.skipText, { color: colors.textPrimary }]}>{t('common.skip')}</Text>
      </Pressable>
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
    width: 186,
    aspectRatio: 1,
    marginTop: 48,
    marginBottom: 160,
    alignSelf: 'center',
  },
  description: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  btn: {
    marginTop: 24,
  },
  skip: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '300',
    textDecorationLine: 'underline',
    lineHeight: 24,
  },
});
