import { BottomSheetFooter } from '@components/BottomSheet';
import Button from '@components/Button';
import Checkbox from '@components/Checkbox';
import TextInput from '@components/TextInput';
import { useTheme } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BackupBottomSheet from './BackupBottomSheet';

type FormData = {
  password: string;
  confirm: string;
};

type PasswordValidation = {
  hasLength: boolean;
  hasLowerCase: boolean;
  hasUpperCase: boolean;
  hasNumber: boolean;
};

const validatePassword = (password: string): PasswordValidation => {
  return {
    hasLength: password.length >= 8,
    hasLowerCase: /[a-z]/.test(password),
    hasUpperCase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
};

export const BackupBsim1Password = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');

  const validation = useMemo(() => validatePassword(password), [password]);
  const [confirm, setConfirm] = useState(false);

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

  const handleSubmitForm = useCallback(async (data: FormData) => {
    console.log(data);
  }, []);

  return (
    <BackupBottomSheet showTitle title={t('backup.BSIM.title')} style={{ flex: 1 }}>
      <Text style={[styles.describe, { color: colors.textSecondary }]}>{t('backup.BSIM.describe')}</Text>

      <Text style={styles.label}>{t('backup.BSIM.password')}</Text>

      <Controller
        control={control}
        rules={{
          required: true,
          validate: (value) => {
            const v = validatePassword(value);
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

      <Text style={styles.label}>{t('backup.BSIM.confirmPassword')}</Text>
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
          <Button testID="createPasswordButton" onPress={handleSubmit(handleSubmitForm)} disabled={!confirm || !isValid} loading={false}>
            {t('initWallet.setPassword.create')}
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
