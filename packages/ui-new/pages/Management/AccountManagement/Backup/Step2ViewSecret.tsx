import CheckIcon from '@assets/icons/check.svg';
import Copy from '@assets/icons/copy.svg';
import MaskPrivateKey from '@assets/images/mask-private-key.webp';
import MaskSeedPhrase from '@assets/images/mask-seed-phrase.webp';
import { BottomSheetFooter, BottomSheetScrollContent } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import useInAsync from '@hooks/useInAsync';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '@react-navigation/native';
import { type BackupScreenProps, type BackupStep2StackName, BackupStep3StackName } from '@router/configs';
import { useAccountById } from '@service/account';
import { useAccountGroup } from '@service/accountGroup';
import { getAuthService, getVaultService, VaultSourceType, VaultType } from '@service/core';
import backToHome from '@utils/backToHome';
import { isSmallDevice } from '@utils/deviceInfo';
import { getErrorCode } from '@utils/error';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import QRCode from 'react-native-qrcode-svg';
import BackupBottomSheet from './BackupBottomSheet';

const BackupStep2ViewSecret: React.FC<BackupScreenProps<typeof BackupStep2StackName>> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const backupType = route.params.groupId ? VaultType.HierarchicalDeterministic : VaultType.PrivateKey;
  const backupText = useMemo(() => (backupType === VaultType.HierarchicalDeterministic ? t('common.seedPhrase') : t('common.privateKey')), [backupType, t]);

  const { data: account } = useAccountById(route.params.accountId);
  const { data: groupOfRoute } = useAccountGroup(route.params.groupId ?? null, true);
  const { data: groupOfAccount } = useAccountGroup(account?.accountGroupId, true);

  const group = route.params.groupId ? groupOfRoute : groupOfAccount;
  const [secretData, setSecretData] = useState<null | string>(() => null);
  const phrases = useMemo(() => (!secretData || backupType === VaultType.PrivateKey ? null : secretData.split(' ')), [secretData, backupType]);

  const _handleClickView = useCallback(async () => {
    try {
      await new Promise((resolve) => setTimeout(() => resolve(null!), 20));
      if (!group) return;
      const password = await getAuthService().getPassword();
      if (backupType === VaultType.HierarchicalDeterministic) {
        setSecretData(await getVaultService().getMnemonic(group.vaultId, password));
      } else {
        if (!account?.currentAddressId) return;
        setSecretData(await getVaultService().getPrivateKey(group.vaultId, account.currentAddressId, password));
      }
    } catch (err) {
      if (getErrorCode(err) === AUTH_PASSWORD_REQUEST_CANCELED) {
        return;
      }
      showMessage({
        message: t('backup.error.viewFailed', { backupText }),
        description: String(err ?? ''),
        type: 'failed',
      });
    }
  }, [group, account?.currentAddressId, backupType, backupText, t]);
  const { inAsync, execAsync: handleClickView } = useInAsync(_handleClickView);

  return (
    <BackupBottomSheet>
      <BottomSheetScrollContent>
        <Text style={[styles.largeText, styles.notice, { color: colors.textPrimary }]} numberOfLines={1}>
          {t('backup.viewSecret.title', { type: backupType === VaultType.HierarchicalDeterministic ? t('common.seedPhrase') : t('common.privateKey') })}
        </Text>
        <View style={styles.noticeDescription}>
          <CheckIcon color={colors.iconPrimary} width={20} height={20} />
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('backup.viewSecret.tips1')}</Text>
        </View>
        <View style={styles.noticeDescription}>
          <CheckIcon color={colors.iconPrimary} width={20} height={20} />
          <Text style={[styles.description, { color: colors.textSecondary }]}>{t('backup.viewSecret.tips2')}</Text>
        </View>
        {backupType === VaultType.PrivateKey && (
          <View style={styles.noticeDescription}>
            <CheckIcon color={colors.iconPrimary} width={20} height={20} />
            <Text style={[styles.description, { color: colors.textSecondary, flex: 1 }]}>{t('backup.viewSecret.tipsForPK')}</Text>
          </View>
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
                <Copy color={colors.textPrimary} />
              </Pressable>
            </>
          )}
          {secretData && backupType === VaultType.HierarchicalDeterministic && (
            <View style={styles.phraseContainer}>
              <View style={styles.phraseColumn}>
                {phrases?.slice(0, 6).map((phrase, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  <Text key={index} style={[styles.phrase, { color: colors.textPrimary, backgroundColor: colors.bgPrimary }]}>
                    {index + 1}. {phrase}
                  </Text>
                ))}
              </View>
              <View style={styles.phraseColumn}>
                {phrases?.slice(6).map((phrase, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  <Text key={index} style={[styles.phrase, { color: colors.textPrimary, backgroundColor: colors.bgPrimary }]}>
                    {index + 7}. {phrase}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </BottomSheetScrollContent>
      <BottomSheetFooter>
        {group?.vaultSource === VaultSourceType.CREATE_BY_WALLET &&
        group?.vaultType === VaultType.HierarchicalDeterministic &&
        !group.isBackup &&
        backupType === VaultType.HierarchicalDeterministic ? (
          <Button
            disabled={!secretData}
            onPress={() => {
              setSecretData(null);
              navigation.navigate(BackupStep3StackName, { phrases: phrases || [], vaultId: group.vaultId });
            }}
            size="small"
          >
            {t('common.next')}
          </Button>
        ) : (
          <Button testID="return" onPress={() => backToHome(navigation)} size="small">
            {t('common.close')}
          </Button>
        )}
      </BottomSheetFooter>
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
  },
  description: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: isSmallDevice ? 16 : 18,
    marginBottom: isSmallDevice ? 6 : 8,
  },
  noticeDescription: {
    display: 'flex',
    flexDirection: 'row',
    gap: 5,
  },
  secretArea: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignContent: 'center',
    marginTop: isSmallDevice ? 8 : 16,
    position: 'relative',
    marginHorizontal: 8,
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
    paddingHorizontal: 10,
  },
  privateKeyText: {
    flex: 1,
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
});

export default BackupStep2ViewSecret;
