import Img from '@assets/images/fundsAtRisk.webp';
import Text from '@components/Text';
import useForceUpdateOnFocus from '@hooks/useUpdateOnFocus';
import { useTheme } from '@react-navigation/native';
import { BackupBSIM1PasswordStackName, BackupStackName, BackupStep1StackName, type HomeStackName, type StackScreenProps } from '@router/configs';
import { VaultType } from '@service/core';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCurrentHomeWallet } from './useCurrentHomeWallet';

const NotBackup: React.FC<{ navigation: StackScreenProps<typeof HomeStackName>['navigation'] }> = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { currentAccountGroupId, currentVault, shouldShowNotBackup } = useCurrentHomeWallet();
  const canBackupCurrentWallet = !!currentVault && (currentVault.type === VaultType.BSIM || !!currentAccountGroupId);

  useForceUpdateOnFocus(navigation);

  const handleBackup = useCallback(() => {
    if (!currentVault) return;

    if (currentVault.type === VaultType.BSIM) {
      navigation.navigate(BackupStackName, { screen: BackupBSIM1PasswordStackName, params: { vaultId: currentVault.id } });
      return;
    }
    if (!currentAccountGroupId) return;
    navigation.navigate(BackupStackName, { screen: BackupStep1StackName, params: { groupId: currentAccountGroupId } });
  }, [currentAccountGroupId, currentVault, navigation]);

  if (!shouldShowNotBackup) return null;
  return (
    <>
      <View style={[styles.divider, { backgroundColor: colors.borderThird }]} pointerEvents="none" />
      <Pressable
        style={({ pressed }) => [styles.container, { backgroundColor: pressed ? colors.underlay : 'transparent', borderColor: colors.borderPrimary }]}
        disabled={!canBackupCurrentWallet}
        onPress={handleBackup}
        testID="backup"
      >
        <Image style={styles.img} source={Img} />
        <View style={styles.textArea}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('home.backup.title')}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            <Trans i18nKey={'home.backup.describe'}>
              You need to back up your phrase to ensure the security of your wallet.
              <Text style={{ color: colors.textNotice, textDecorationColor: colors.textNotice, textDecorationLine: 'underline' }}>Back Up{'>'}</Text>
            </Trans>
          </Text>
        </View>
      </Pressable>
    </>
  );
};

const styles = StyleSheet.create({
  divider: {
    marginBottom: 16,
    height: 1,
  },
  container: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 8,
    height: 80,
    paddingHorizontal: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  img: {
    flexShrink: 0,
    alignSelf: 'center',
    width: 53,
    aspectRatio: 1.07,
    marginRight: 12,
  },
  textArea: {
    width: '100%',
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  description: {
    fontSize: 12,
    fontWeight: '300',
    lineHeight: 16,
  },
});

export default NotBackup;
