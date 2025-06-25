import i18n from '@assets/i18n';
import Img from '@assets/images/fingerPrint.webp';
import Button from '@components/Button';
import Text from '@components/Text';
import plugins from '@core/WalletCore/Plugins';
import useInAsync from '@hooks/useInAsync';
import { CommonActions, useTheme } from '@react-navigation/native';
import { type BiometricsWayStackName, HomeStackName, PasswordWayStackName, type StackScreenProps } from '@router/configs';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import createVault from './createVaultWithRouterParams';
import { useAuthentication } from '@hooks/useCore';

export const showBiometricsDisabledMessage = () => {
  showMessage({
    message: i18n.t('initWallet.biometrics.disable.error.title'),
    description: i18n.t('initWallet.biometrics.disable.error.description'),
    type: 'warning',
  });
};

const BiometricsWay: React.FC<StackScreenProps<typeof BiometricsWayStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const authentication = useAuthentication();

  const _handleCreateVault = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      const supportedBiometryType = await authentication.getSupportedBiometryType();
      if (supportedBiometryType === null) {
        showBiometricsDisabledMessage();
        return;
      }
      await authentication.setPassword({ authType: authentication.AuthenticationType.Biometrics });
      await new Promise((resolve) => setTimeout(() => resolve(null!), 20));
      if (await createVault(route.params)) {
        navigation.navigate(HomeStackName);
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
      }
    } catch (err) {
      console.log('Init Wallet by BiometricsWay error: ', err);
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { inAsync, execAsync: handleCreateVault } = useInAsync(_handleCreateVault);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {t('initWallet.enableFingerprint')}
      </Text>
      <Image style={styles.img} source={Img} contentFit="contain" />

      <Text style={[styles.description, { color: colors.textPrimary }]}>
        <Trans i18nKey={'initWallet.describe'}>
          Enable <Text style={{ color: colors.textNotice, fontWeight: '600' }}>Fingerprint</Text> to access wallet. After enabled, you can unlock wallets or
          make transactions by verifying your
          <Text style={{ color: colors.textNotice, fontWeight: '600' }}>Fingerprint</Text>.
        </Trans>
      </Text>
      <Button testID="enable" style={styles.btnEnable} loading={inAsync} onPress={handleCreateVault}>
        {t('common.enable')}
      </Button>

      <Pressable
        style={({ pressed }) => [styles.gotoSetpwd, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => navigation.navigate(PasswordWayStackName, route.params)}
        disabled={inAsync}
        testID="setPassword"
      >
        <Text style={[styles.gotoSetpwdText, { color: colors.textPrimary }]}>{t('initWallet.setPassword')}</Text>
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
    width: 160,
    aspectRatio: 1,
    marginTop: 64,
    marginBottom: 100,
    alignSelf: 'center',
  },
  description: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  btnEnable: {
    marginTop: 80,
    marginBottom: 4,
  },
  gotoSetpwd: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gotoSetpwdText: {
    fontSize: 16,
    fontWeight: '300',
  },
});

export default BiometricsWay;
