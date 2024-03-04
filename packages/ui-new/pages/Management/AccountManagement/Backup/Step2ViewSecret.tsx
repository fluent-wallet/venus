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

const BackupStep2ViewSecret: React.FC<BackupScreenProps<typeof BackupStep2StackName>> = ({ route, navigation }) => {
  const { colors } = useTheme();

  const backupType = route.params.groupId ? VaultType.HierarchicalDeterministic : VaultType.PrivateKey;
  const backupText = useMemo(() => (backupType === VaultType.HierarchicalDeterministic ? 'seed phrase' : 'private key'), [backupType]);

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
    <BackupBottomSheet onClose={navigation.goBack}>
      <Text style={[styles.largeText, styles.notice, { color: colors.textPrimary }]}>
        ✏️ Write Down Your {backupType === VaultType.HierarchicalDeterministic ? 'Seed Phrase' : 'Private Key'}
      </Text>
      <Text style={[styles.description, styles.noticeDescription, { color: colors.textSecondary }]}>✅ Do NOT take a screenshot of this page</Text>
      <Text style={[styles.description, styles.noticeDescription, { color: colors.textSecondary }]}>✅ Writing down on paper is recommended</Text>
      {backupType === VaultType.PrivateKey && (
        <Text style={[styles.description, styles.noticeDescription, { color: colors.textSecondary }]}>
          ✅ Or scan the QR code directly from the trusted app you wish to import to
        </Text>
      )}
      <View style={[styles.secretArea, { borderColor: colors.borderFourth }]}>
        {!secretData && (
          <>
            <Image style={styles.mask} source={backupType === VaultType.HierarchicalDeterministic ? MaskSeedPhrase : MaskPrivateKey} contentFit="contain" />

            <Text style={[styles.largeText, { color: colors.textPrimary, textAlign: 'center' }]}>Tap to view the {backupText}</Text>
            <Text style={[styles.description, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>Make sure your environment is safe</Text>
            <Button style={styles.viewBtn} mode="auto" onPress={handleClickView} loading={inAsync}>
              View
            </Button>
          </>
        )}
        {secretData && backupType === VaultType.PrivateKey && (
          <>
            <View style={styles.qrcode}>
              <QRCode value={secretData} size={240} />
            </View>
            <Pressable
              onPress={() => {
                Clipboard.setString(secretData);
                showMessage({
                  message: 'Copied!',
                  type: 'success',
                  duration: 1500,
                  width: 160,
                });
              }}
              style={({ pressed }) => [styles.privateKey, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            >
              <Text style={[styles.privateKeyText, { color: colors.textPrimary }]}>{secretData}</Text>
              <Copy color={colors.iconPrimary} />
            </Pressable>
          </>
        )}
        {secretData && backupType === VaultType.HierarchicalDeterministic && (
          <View style={styles.phraseContainer}>
            {phrases?.map((phrase, index) => (
              <Text key={index} style={[styles.phrase, { color: colors.textPrimary, backgroundColor: colors.bgPrimary }]}>
                {index + 1}. {phrase}
              </Text>
            ))}
          </View>
        )}
      </View>

      {vault?.source === VaultSourceType.CREATE_BY_WALLET &&
      vault?.type === VaultType.HierarchicalDeterministic &&
      !vault.isBackup &&
      backupType === VaultType.HierarchicalDeterministic ? (
        <Button
          style={styles.btn}
          mode="auto"
          disabled={!secretData}
          onPress={() => {
            setSecretData(null);
            navigation.navigate(BackupStep3StackName, { phrases: phrases || [], vaultId: vault.id });
          }}
        >
          Next
        </Button>
      ) : (
        <Button style={styles.btn} mode="auto" onPress={() => navigation.goBack()}>
          Return
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
    paddingHorizontal: 44,
  },
  secretArea: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignContent: 'center',
    marginTop: isSmallDevice ? 8 : 16,
    position: 'relative',
    marginHorizontal: 24,
    height: 316,
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  qrcode: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  privateKey: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    flexDirection: 'column',
    flexWrap: 'wrap',
    gap: 8,
  },
  phrase: {
    flexShrink: 1,
    width: '50%',
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
