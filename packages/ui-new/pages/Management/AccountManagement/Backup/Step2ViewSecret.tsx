import React, { useState, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { showMessage } from 'react-native-flash-message';
import QRCode from 'react-native-qrcode-svg';
import { Image } from 'expo-image';
import { useCurrentAddressOfAccount, useVaultOfGroup, VaultType, VaultSourceType } from '@core/WalletCore/Plugins/ReactInject';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import Text from '@components/Text';
import Button from '@components/Button';
import useInAsync from '@hooks/useInAsync';
import { BackupStep2StackName, BackupStep3StackName, type BackupScreenProps } from '@router/configs';
import { isSmallDevice } from '@utils/deviceInfo';
import MaskPrivateKey from '@assets/images/mask-private-key.webp';
import MaskSeedPhrase from '@assets/images/mask-seed-phrase.webp';
import Copy from '@assets/icons/copy.svg';
import BackupBottomSheet from './BackupBottomSheet';
import { useTranslation } from 'react-i18next';

const BackupStep2ViewSecret: React.FC<BackupScreenProps<typeof BackupStep2StackName>> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const backupType = route.params.groupId ? VaultType.HierarchicalDeterministic : VaultType.PrivateKey;
  const backupText = useMemo(() => (backupType === VaultType.HierarchicalDeterministic ? t('common.seedPhrase') : t('common.privateKey')), [backupType]);

  const address = useCurrentAddressOfAccount(route.params.accountId);
  const vault = useVaultOfGroup(route.params.groupId);
  const [secretData, setSecretData] = useState<null | string>(() => null);
  const phrases = useMemo(() => (!secretData || backupType === VaultType.PrivateKey ? null : secretData.split(' ')), [secretData, backupType]);

  const _handleClickView = useCallback(async () => {
    try {
      if (backupType === VaultType.HierarchicalDeterministic) {
        if (!vault) return;
        setSecretData(await methods.getMnemonicOfVault(vault));
      } else {
        if (!address) return;
        setSecretData(await methods.getPrivateKeyOfAddress(address));
      }
    } catch (err) {
      if (plugins.Authentication.containsCancel(String(err))) {
        return;
      }
      showMessage({
        message: `View ${backupText} failed`,
        description: String(err ?? ''),
        type: 'failed',
      });
    }
  }, [vault, address, backupType, backupText]);
  const { inAsync, execAsync: handleClickView } = useInAsync(_handleClickView);

  return (
    <BackupBottomSheet>
      <Text style={[styles.largeText, styles.notice, { color: colors.textPrimary }]} numberOfLines={1}>
        {t('backup.viewSecret.title', { type: backupType === VaultType.HierarchicalDeterministic ? t('common.seedPhrase') : t('common.privateKey') })}
      </Text>
      <Text style={[styles.description, styles.noticeDescription, { color: colors.textSecondary }]}>{t('backup.viewSecret.tips1')}</Text>
      <Text style={[styles.description, styles.noticeDescription, { color: colors.textSecondary }]}>{t('backup.viewSecret.tips2')}</Text>
      {backupType === VaultType.PrivateKey && (
        <Text style={[styles.description, styles.noticeDescription, { color: colors.textSecondary }]}>{t('backup.viewSecret.tipsForPK')}</Text>
      )}
      <View style={[styles.secretArea, { borderColor: colors.borderFourth }]}>
        {!secretData && (
          <>
            <Image style={styles.mask} source={backupType === VaultType.HierarchicalDeterministic ? MaskSeedPhrase : MaskPrivateKey} contentFit="contain" />

            <Text style={[styles.largeText, { color: colors.textPrimary, textAlign: 'center' }]}>{t('backup.viewSecret.view', { type: backupText })}</Text>
            <Text style={[styles.description, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>{t('backup.viewSecret.viewTips')}</Text>
            <Button testID="view" style={styles.viewBtn} onPress={handleClickView} loading={inAsync}>
              {t('common.view')}
            </Button>
          </>
        )}
        {secretData && backupType === VaultType.PrivateKey && (
          <>
            <View style={styles.qrcode}>
              <QRCode value={secretData} size={isSmallDevice ? 220 : 240} />
            </View>
            <Pressable
              onPress={() => {
                Clipboard.setString(secretData);
                showMessage({
                  message: t('common.copied'),
                  type: 'success',
                  duration: 1500,
                  width: 160,
                });
              }}
              style={({ pressed }) => [styles.privateKey, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
              testID="copy"
            >
              <Text style={[styles.privateKeyText, { color: colors.textPrimary }]}>{secretData}</Text>
              <Copy color={colors.iconPrimary} />
            </Pressable>
          </>
        )}
        {secretData && backupType === VaultType.HierarchicalDeterministic && (
          <View style={styles.phraseContainer}>
            <View style={styles.phraseColumn}>
              {phrases?.slice(0, 6).map((phrase, index) => (
                <Text key={index} style={[styles.phrase, { color: colors.textPrimary, backgroundColor: colors.bgPrimary }]}>
                  {index + 1}. {phrase}
                </Text>
              ))}
            </View>
            <View style={styles.phraseColumn}>
              {phrases?.slice(6).map((phrase, index) => (
                <Text key={index} style={[styles.phrase, { color: colors.textPrimary, backgroundColor: colors.bgPrimary }]}>
                  {index + 7}. {phrase}
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {vault?.source === VaultSourceType.CREATE_BY_WALLET &&
      vault?.type === VaultType.HierarchicalDeterministic &&
      !vault.isBackup &&
      backupType === VaultType.HierarchicalDeterministic ? (
        <Button
          style={styles.btn}
          disabled={!secretData}
          onPress={() => {
            setSecretData(null);
            navigation.navigate(BackupStep3StackName, { phrases: phrases || [], vaultId: vault.id });
          }}
          size="small"
        >
          {t('common.next')}
        </Button>
      ) : (
        <Button testID="return" style={styles.btn} onPress={() => navigation.goBack()} size="small">
          {t('common.return')}
        </Button>
      )}
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  largeText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  notice: {
    marginTop: isSmallDevice ? 10 : 20,
    marginBottom: 16,
    paddingHorizontal: 0,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: isSmallDevice ? 16 : 18,
    marginBottom: isSmallDevice ? 6 : 8,
  },
  noticeDescription: {
    paddingHorizontal: isSmallDevice ? 22 : 44,
  },
  secretArea: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignContent: 'center',
    marginTop: isSmallDevice ? 8 : 16,
    position: 'relative',
    marginHorizontal: 24,
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
    minHeight: isSmallDevice ? 300 : 316,
  },
  qrcode: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  privateKey: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallDevice ? 12 : 16,
  },
  privateKeyText: {
    width: '92%',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 'auto',
  },
  phraseContainer: {
    margin: 16,
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
  },
  phraseColumn: {
    width: '50%',
    flexShrink: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  phrase: {
    lineHeight: 40,
    paddingLeft: 16,
    borderRadius: 6,
    fontSize: 16,
    fontWeight: '600',
  },
  mask: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  viewBtn: {
    width: 184,
    alignSelf: 'center',
    marginTop: 20,
  },
  btn: {
    marginTop: 'auto',
    marginBottom: isSmallDevice ? 16 : 32,
    marginHorizontal: 16,
  },
});

export default BackupStep2ViewSecret;
