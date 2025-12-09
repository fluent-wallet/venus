import SuccessfullyIcon from '@assets/icons/successful.svg';
import WarnIcon from '@assets/icons/warn.svg';
import RecoverBSIMImg from '@assets/images/recoverBSIM.svg';
import { BottomSheetContent, BottomSheetFooter, BottomSheetHeader, BottomSheetWrapper, InlineBottomSheet, snapPoints } from '@components/BottomSheet';
import Button from '@components/Button';
import CustomTextInput from '@components/TextInput';
import Plugins from '@core/WalletCore/Plugins';
import QrScannerSheet, { type ParseResult } from '@pages/ExternalInputHandler/QrScannerSheet';
import { StackActions, useNavigation, useTheme } from '@react-navigation/native';
import { ChangeBPinStackName, type StackNavigation } from '@router/configs';
import { verifyPasswordTag } from '@utils/BSIMCrypto';
import { validateKey2Password } from '@utils/BSIMKey2PasswordValidation';
import type { BsimQrPayload } from '@utils/BSIMTypes';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

type RecoverFormData = {
  password: string;
};
export const RecoverBSIM = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [showScan, setShowScan] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);

  const [bsimQrPayload, setBsimQrPayload] = useState<BsimQrPayload | null>(null);

  const navigation = useNavigation<StackNavigation>();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RecoverFormData>({
    mode: 'all',
    defaultValues: {
      password: '',
    },
  });

  const handleScanQrCode = useCallback((data: BsimQrPayload) => {
    setShowScan(false);
    setShowPassword(true);
    setBsimQrPayload(data);
  }, []);

  const handleNext = async (data: RecoverFormData) => {
    if (!bsimQrPayload || !verifyPasswordTag(data.password, bsimQrPayload)) {
      showMessage({ type: 'failed', message: t('initWallet.recoverBSIM.invalidPassword') });
      return;
    }

    try {
      await Plugins.BSIM.restoreSeed(data.password, bsimQrPayload.seed_ct);
    } catch (error: any) {
      if (handleBSIMHardwareUnavailable(error, navigation)) {
        return;
      }
      showMessage({ type: 'failed', message: error.message });
      return;
    }

    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setShowPassword(false);
    setBsimQrPayload(null);
    navigation.dispatch(StackActions.replace(ChangeBPinStackName));
  };

  const handleParseInput = (raw: string): ParseResult<BsimQrPayload> => {
    try {
      const parsedData = JSON.parse(atob(raw)) as Partial<BsimQrPayload>;
      // check the validity of the data
      if (!parsedData.seed_ct || !parsedData.iv || !parsedData.iccid_ct || !parsedData.pwd_tag) {
        return { ok: false, message: t('initWallet.recoverBSIM.invalidQRData') };
      }
      return {
        ok: true,
        data: parsedData as BsimQrPayload,
      };
    } catch {
      return { ok: false, message: t('initWallet.recoverBSIM.invalidQRData') };
    }
  };

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {t('initWallet.recoverBSIM.title')}
        </Text>

        <RecoverBSIMImg style={styles.img} />

        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('common.notice')}</Text>

        <Text style={[styles.description, { color: colors.textPrimary }]}>
          <Trans i18nKey={'initWallet.recoverBSIM.describe.part1'}>
            This operation will restore your wallet to this BSIM card using your backup
            <Text style={[styles.highlight, { color: colors.textNotice }]}>QR code</Text> and
            <Text style={[styles.highlight, { color: colors.textNotice }]}>backup password</Text>.
          </Trans>
        </Text>

        <Text style={[styles.description, { color: colors.textPrimary }]}>
          <Trans i18nKey={'initWallet.recoverBSIM.describe.part2'}>
            Please make sure your new BSIM card is properly inserted. Ensure that both your QR code and backup password are
            <Text style={[styles.highlight, { color: colors.textNotice }]}>correct</Text>.
          </Trans>
        </Text>

        <View style={styles.warn}>
          <WarnIcon color={colors.middle} />
          <Text style={[styles.warningText, { color: colors.textNotice }]}>{t('initWallet.recoverBSIM.warning')}</Text>
        </View>

        <Button onPress={() => setShowScan(true)}>{t('common.next')}</Button>
      </ScrollView>

      {showScan && (
        <QrScannerSheet
          mode="inline"
          title={t('initWallet.recoverBSIM.title')}
          onConfirm={handleScanQrCode}
          onClose={() => setShowScan(false)}
          parseInput={handleParseInput}
        />
      )}

      {showPassword && (
        <InlineBottomSheet snapPoints={snapPoints.percent85} index={0}>
          <BottomSheetWrapper innerPaddingHorizontal>
            <BottomSheetHeader title={t('initWallet.recoverBSIM.title')} />

            <BottomSheetContent>
              <Text style={[styles.labelText, { color: colors.textPrimary }]}>{t('backup.BSIM.password')}</Text>

              <Controller
                control={control}
                rules={{
                  required: true,
                  validate: (value) => {
                    const v = validateKey2Password(value);
                    return v.hasLength && v.hasLowerCase && v.hasUpperCase && v.hasNumber;
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <View>
                    <CustomTextInput
                      placeholder={t('common.password')}
                      secureTextEntry
                      onBlur={onBlur}
                      onChangeText={(text) => {
                        onChange(text);
                      }}
                      value={value}
                      containerStyle={errors.password && [{ borderColor: colors.down, borderWidth: 1 }]}
                    />
                  </View>
                )}
                name="password"
              />

              <Text style={[styles.ruleText, { color: colors.textPrimary }]}>{t('initWallet.recoverBSIM.pwdRule')}</Text>
            </BottomSheetContent>

            <BottomSheetFooter>
              <Button testID="createPasswordButton" onPress={handleSubmit(handleNext)} disabled={!isValid}>
                {t('common.next')}
              </Button>
            </BottomSheetFooter>
          </BottomSheetWrapper>
        </InlineBottomSheet>
      )}

      {showSuccess && (
        <InlineBottomSheet snapPoints={snapPoints.percent45} index={showSuccess ? 0 : -1} onClose={handleSuccessClose}>
          <BottomSheetWrapper innerPaddingHorizontal>
            <BottomSheetHeader title={t('common.successfully')} />

            <View style={styles.successIconContainer}>
              <SuccessfullyIcon width={100} height={100} />
            </View>
            <Text style={[styles.successText, { color: colors.textPrimary }]}>{t('initWallet.recoverBSIM.success')}</Text>
          </BottomSheetWrapper>
        </InlineBottomSheet>
      )}
    </>
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
    width: 240,
    aspectRatio: 1,
    alignSelf: 'center',
  },
  description: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '300',
  },
  highlight: {
    fontWeight: '600',
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 26,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 16,
  },
  successIconContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 16,
  },
  ruleText: {
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 16,
    marginTop: 8,
  },
  successText: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 24,
  },
});
