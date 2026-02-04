import BSIM from '@WalletCoreExtends/Plugins/BSIM';
import { BottomSheetFooter } from '@components/BottomSheet';
import Button from '@components/Button';
import Checkbox from '@components/Checkbox';
import HourglassLoading from '@components/Loading/Hourglass';
import TextInput from '@components/TextInput';
import { useNavigation, useTheme } from '@react-navigation/native';
import { type BackupBSIM1PasswordStackName, BackupBSIMQ2RCodeStackName, type BackupScreenProps, type StackNavigation } from '@router/configs';
import { validateKey2Password } from '@utils/BSIMKey2PasswordValidation';
import { handleBSIMHardwareUnavailable } from '@utils/handleBSIMHardwareUnavailable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import BackupBottomSheet from './BackupBottomSheet';

type FormData = {
  password: string;
  confirm: string;
};

export const BSIMStep1Password: React.FC<BackupScreenProps<typeof BackupBSIM1PasswordStackName>> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const validation = useMemo(() => validateKey2Password(password), [password]);
  const [confirm, setConfirm] = useState(false);
  const rootNavigation = useNavigation<StackNavigation>();
  const [loading, setLoading] = useState(false);
  const cancelRequestRef = useRef<(() => void) | null>(null);
  const {
    control,
    handleSubmit,
    getValues,
    watch,
    trigger,
    formState: { errors, isValid },
  } = useForm<FormData>({
    mode: 'all',
    defaultValues: {
      password: '',
      confirm: '',
    },
  });

  const passwordValue = watch('password');
  const confirmValue = watch('confirm');

  useEffect(() => {
    if (confirmValue) {
      trigger('confirm');
    }
  }, [passwordValue, confirmValue, trigger]);

  const handleCancel = useCallback(() => {
    if (cancelRequestRef.current) {
      cancelRequestRef.current();
      cancelRequestRef.current = null;
      setLoading(false);
    }
  }, []);

  const handleSubmitForm = useCallback(
    async (data: FormData) => {
      try {
        const { confirm } = data;
        setLoading(true);
        await BSIM.verifyBPIN();
        const [request, cancelRequest] = await BSIM.backupSeed(confirm);
        cancelRequestRef.current = cancelRequest;
        const seedData = await request;

        navigation.navigate(BackupBSIMQ2RCodeStackName, { backupPassword: confirm, seedData, vaultId: route.params.vaultId });
      } catch (error: any) {
        if (handleBSIMHardwareUnavailable(error, rootNavigation)) {
          return;
        }
        showMessage({ type: 'failed', message: error.message });
      } finally {
        setLoading(false);
        cancelRequestRef.current = null;
      }
    },
    [navigation, rootNavigation, route.params.vaultId],
  );

  return (
    <BackupBottomSheet showTitle title={t('backup.BSIM.title')} style={{ flex: 1 }}>
      <Text style={[styles.describe, { color: colors.textSecondary }]}>{t('backup.BSIM.describe')}</Text>

      <Text style={[styles.label, { color: colors.textPrimary }]}>{t('backup.BSIM.password')}</Text>

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
            <TextInput
              placeholder={t('common.password')}
              secureTextEntry
              onBlur={onBlur}
              onChangeText={(text) => {
                setPassword(text);
                onChange(text);
              }}
              value={value}
            />
            <View style={styles.validationContainer}>
              <ValidationRule label={t('backup.BSIM.ruleLength')} isValid={validation.hasLength} />
              <ValidationRule label={t('backup.BSIM.ruleLowerCase')} isValid={validation.hasLowerCase} />
              <ValidationRule label={t('backup.BSIM.ruleUpperCase')} isValid={validation.hasUpperCase} />
              <ValidationRule label={t('backup.BSIM.ruleNumber')} isValid={validation.hasNumber} />
            </View>
          </View>
        )}
        name="password"
      />

      <Text style={[styles.label, { color: colors.textPrimary }]}>{t('backup.BSIM.confirmPassword')}</Text>
      <Controller
        control={control}
        rules={{
          required: true,
          minLength: 8,
          validate: (confirmValue) => {
            const { password } = getValues();
            return password === confirmValue;
          },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            placeholder={t('common.password')}
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            containerStyle={errors.confirm && [styles.errorInput, { borderColor: colors.down }]}
          />
        )}
        name="confirm"
      />

      <View style={{ marginTop: 'auto' }}>
        <Pressable testID="checkbox" style={styles.rememberView} onPress={() => setConfirm((pre) => !pre)}>
          <Checkbox checked={confirm} pointerEvents="none" />
          <Text style={[styles.rememberText, { color: colors.textPrimary }]}>
            <Trans i18nKey={'initWallet.setPassword.check'}>
              BIM Wallet Wallet does not store your password. Please <Text style={{ color: colors.textNotice, fontWeight: '600' }}>remember</Text> your
              password.
            </Trans>
          </Text>
        </Pressable>

        <BottomSheetFooter>
          <Button
            testID="createPasswordButton"
            onPress={loading ? handleCancel : handleSubmit(handleSubmitForm)}
            disabled={!confirm || !isValid}
            Icon={loading ? (HourglassLoading as any) : undefined}
          >
            {loading ? t('common.cancel') : t('initWallet.setPassword.create')}
          </Button>
        </BottomSheetFooter>
      </View>
    </BackupBottomSheet>
  );
};

const ValidationRule = ({ label, isValid }: { label: string; isValid: boolean }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.validationRule}>
      <View
        style={[
          styles.validationBar,
          {
            backgroundColor: isValid ? colors.bgSelect : '#F1F4F8',
          },
        ]}
      />
      <Text
        style={[
          styles.validationText,
          {
            color: isValid ? colors.textPrimary : colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  describe: {
    fontSize: 16,
    fontWeight: '300',
  },
  label: {
    marginVertical: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  validationContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  validationRule: {
    flex: 1,
    gap: 8,
  },
  validationBar: {
    height: 4,
    borderRadius: 2,
  },
  validationText: {
    fontSize: 12,
    textAlign: 'center',
  },
  rememberView: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    marginLeft: 16,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  errorInput: {
    borderWidth: 1,
  },
});
