import i18n from '@assets/i18n';
import Img from '@assets/images/fingerPrint.webp';
import Button from '@components/Button';
import Text from '@components/Text';
import useInAsync from '@hooks/useInAsync';
import { useTheme } from '@react-navigation/native';
import { type BiometricsWayStackName, PasswordWayStackName, type StackScreenProps } from '@router/configs';
import { createBiometricVaultPassword, getBiometricVaultPassword, resetBiometricVaultPassword } from '@service/biometricVaultPasswordStore';
import { getAuthService } from '@service/core';
import { executeWalletCreation } from '@service/walletCreation';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import * as Keychain from 'react-native-keychain';
import { handleWalletCreationResult } from './walletCreationResultHandler';

export const showBiometricsDisabledMessage = () => {
  showMessage({
    message: i18n.t('initWallet.biometrics.disable.error.title'),
    description: i18n.t('initWallet.biometrics.disable.error.description'),
    type: 'warning',
  });
};

const isBiometricPromptCanceled = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes('cancel');
};

const BiometricsWay: React.FC<StackScreenProps<typeof BiometricsWayStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const _handleCreateVault = useCallback(async () => {
    const auth = getAuthService();
    const promptTitle = i18n.t('authentication.title');
    const previousCredentialKind = auth.getCredentialKindValue();
    let shouldRollbackBiometricPassword = false;
    let shouldRollbackCredentialKind = false;

    const rollbackCredentialKind = async () => {
      if (!shouldRollbackCredentialKind) {
        return;
      }

      try {
        await auth.setCredentialKind(previousCredentialKind);
      } catch (error) {
        console.warn('[InitWallet/BiometricsWay] Failed to rollback credential kind.', error);
      } finally {
        shouldRollbackCredentialKind = false;
      }
    };

    const rollbackBiometricPassword = async () => {
      if (!shouldRollbackBiometricPassword) {
        return;
      }

      try {
        await resetBiometricVaultPassword();
      } catch (error) {
        console.warn('[InitWallet/BiometricsWay] Failed to reset biometric vault password.', error);
      } finally {
        shouldRollbackBiometricPassword = false;
      }
    };

    try {
      navigation.setOptions({ gestureEnabled: false });
      const supportedBiometryType = await Keychain.getSupportedBiometryType();
      if (supportedBiometryType === null) {
        showBiometricsDisabledMessage();
        return;
      }

      await createBiometricVaultPassword({ promptTitle });
      shouldRollbackBiometricPassword = true;

      await auth.setCredentialKind('biometrics');
      shouldRollbackCredentialKind = true;

      const vaultPassword = await getBiometricVaultPassword({ promptTitle });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });
      const result = await executeWalletCreation(route.params, vaultPassword);

      if (handleWalletCreationResult({ navigation, result })) {
        shouldRollbackBiometricPassword = false;
        shouldRollbackCredentialKind = false;
        return;
      }

      await rollbackCredentialKind();
      await rollbackBiometricPassword();
    } catch (err) {
      console.log('Init Wallet by BiometricsWay error: ', err);

      await rollbackCredentialKind();
      await rollbackBiometricPassword();

      if (!isBiometricPromptCanceled(err)) {
        showMessage({
          type: 'failed',
          message: t('initWallet.msg.failed'),
          description: String(err) ?? '',
        });
      }
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
  }, [navigation, route.params, t]);

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
