import BSIM from '@WalletCoreExtends/Plugins/BSIM';
import Logo from '@assets/icons/BSIMQRCode.png';
import SuccessfullyIcon from '@assets/icons/successful.svg';
import { BottomSheetFooter, BottomSheetHeader, BottomSheetWrapper, InlineBottomSheet, snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import { stripHexPrefix } from '@core/utils/base';
import { useVaultFromId } from '@core/WalletCore/Plugins/ReactInject';
import { useNavigation, useTheme } from '@react-navigation/native';
import type { BackupBSIMQ2RCodeStackName, BackupScreenProps, StackNavigation } from '@router/configs';
import { BSIM_QR_VERSION } from '@utils/BSIMConstants';
import { encryptICCID, generateIV, generatePasswordTag } from '@utils/BSIMCrypto';
import { encodeBsimDerivationSnapshot } from '@utils/BSIMDerivationSnapshot';
import type { BsimQrPayload } from '@utils/BSIMTypes';
import backToHome from '@utils/backToHome';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import * as MediaLibrary from 'expo-media-library';
import { Hex } from 'ox';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import BackupBottomSheet from './BackupBottomSheet';

export const BSIMStep2QRCode: React.FC<BackupScreenProps<typeof BackupBSIMQ2RCodeStackName>> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { mode, colors } = useTheme();
  const vault = useVaultFromId(route.params.vaultId);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const qrCodeRef = useRef<ViewShot>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const rootNavigation = useNavigation<StackNavigation>();
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { backupPassword, seedData } = route.params;
        const version = await BSIM.getBSIMVersion();
        const iccid = await BSIM.getBSIMICCID();
        const iv = generateIV();
        const iccid_ct = encryptICCID(iccid, iv);
        const pwd_tag = generatePasswordTag(backupPassword, iv);

        const ivHex = stripHexPrefix(Hex.from(iv)).toLowerCase();
        const iccidHex = stripHexPrefix(iccid_ct).toLowerCase();
        const pwdTagHex = stripHexPrefix(pwd_tag).toLowerCase();

        const isHex = (value: string) => /^[0-9a-f]+$/i.test(value);
        const validate = (cond: boolean) => {
          if (!cond) throw new Error(t('backup.BSIM.generateFailed'));
        };

        validate(isHex(ivHex) && ivHex.length === 32);
        validate(isHex(iccidHex) && iccidHex.length > 0 && iccidHex.length % 2 === 0);
        validate(isHex(pwdTagHex) && pwdTagHex.length === 4);

        const pubkeyRecords = await BSIM.exportPubkeyRecords();
        const d = encodeBsimDerivationSnapshot(pubkeyRecords);
        const payload: BsimQrPayload = {
          v: BSIM_QR_VERSION,
          version,
          seed_ct: seedData,
          iv: ivHex,
          iccid_ct: iccidHex,
          pwd_tag: pwdTagHex,
          d,
        };
        const jsonStr = JSON.stringify(payload);
        const qrDataBase64 = btoa(jsonStr);

        setQrData(qrDataBase64);
      } catch (error: any) {
        console.error('Failed to generate QR code:', error);
        if (handleBSIMHardwareUnavailable(error, rootNavigation)) {
          return;
        }
        showMessage({
          type: 'failed',
          message: error?.message,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [route.params.backupPassword, route.params.seedData]);

  const saveToPhotos = useCallback(async () => {
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        showMessage({
          type: 'failed',
          message: t('backup.BSIM.permissionDenied'),
        });
        return;
      }
      const uri = await qrCodeRef.current?.capture?.();
      if (!uri) {
        throw new Error('Failed to capture QR code');
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      await vault?.finishBackup?.();
      showMessage({
        type: 'success',
        message: t('backup.BSIM.savedToPhotos'),
      });
      setShowSuccess(true);
    } catch (error: any) {
      showMessage({
        type: 'failed',
        message: error?.message,
      });
    } finally {
      setSaving(false);
    }
  }, [vault, t]);

  const handleSuccessClose = useCallback(() => {
    backToHome(navigation);
  }, []);

  return (
    <>
      <BackupBottomSheet showTitle title={t('backup.BSIM.title')} style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <HourglassLoading />
          </View>
        ) : (
          <>
            <ViewShot ref={qrCodeRef} options={{ format: 'png', quality: 1.0 }} style={styles.viewShot}>
              <View style={[styles.qrCodeContainer, { backgroundColor: colors.bgPrimary }]}>
                <Text style={[styles.describeText, { color: colors.textPrimary }]}>{t('backup.BSIM.QRCodeDescribe')}</Text>

                <View style={styles.qrCodeWrapper}>
                  <QRCode
                    value={qrData}
                    size={220}
                    logo={Logo}
                    logoSize={40}
                    logoBackgroundColor="transparent"
                    backgroundColor={colors.bgPrimary}
                    color={colors.textPrimary}
                  />
                </View>
              </View>
            </ViewShot>

            <View style={styles.footer}>
              <Pressable testID="checkbox" style={styles.checkboxContainer} onPress={() => setConfirm((pre) => !pre)}>
                <Checkbox checked={confirm} pointerEvents="none" />
                <Text style={[styles.confirmText, { color: colors.textPrimary }]}>
                  <Trans i18nKey={'backup.BSIM.QRCodeBackupConfirm'}>
                    Please <Text style={[styles.highlightText, { color: colors.textNotice }]}>save</Text> your QR code carefully. You will need
                    <Text style={[styles.highlightText, { color: colors.textNotice }]}>both this QR code and backup password </Text> to recover your wallet
                    ifyour BSIM card is lost or replaced.
                  </Trans>
                </Text>
              </Pressable>

              <BottomSheetFooter>
                <Button testID="saveToPhotosButton" onPress={saveToPhotos} disabled={!confirm || loading || saving}>
                  {saving ? t('common.saving') : t('common.photos')}
                </Button>
              </BottomSheetFooter>
            </View>
          </>
        )}
      </BackupBottomSheet>

      {showSuccess && (
        <InlineBottomSheet snapPoints={snapPoints.percent45} index={showSuccess ? 0 : -1} onClose={handleSuccessClose}>
          <BottomSheetWrapper innerPaddingHorizontal>
            <BottomSheetHeader title={t('common.successfully')} />

            <View style={styles.successIconContainer}>
              <SuccessfullyIcon width={100} height={100} />
            </View>
            <Text style={[{ fontSize: 16, fontWeight: '300', lineHeight: 24 }, { color: colors.textPrimary }]}>
              <Trans i18nKey={'backup.BSIM.saveSuccess'}>
                The backup QR code has been saved to your album successfully. <Text style={[styles.highlightText, { color: colors.textNotice }]}>Remember</Text>{' '}
                to keep your backup password and QR code, it’s your responsibility!
              </Trans>
            </Text>
          </BottomSheetWrapper>
        </InlineBottomSheet>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewShot: {
    alignSelf: 'center',
  },
  qrCodeContainer: {
    marginTop: 20,
    marginHorizontal: 20,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  describeText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  qrCodeWrapper: {
    marginVertical: 24,
  },
  footer: {
    marginTop: 'auto',
  },
  checkboxContainer: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmText: {
    marginLeft: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },

  highlightText: {
    fontWeight: '600',
  },
  successIconContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
});
