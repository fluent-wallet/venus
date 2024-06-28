import Button from '@components/Button';
import Checkbox from '@components/Checkbox';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import plugins from '@core/WalletCore/Plugins';
import useInAsync from '@hooks/useInAsync';
import { CommonActions, useTheme } from '@react-navigation/native';
import { HomeStackName, type PasswordWayStackName, type StackScreenProps } from '@router/configs';
import { isDev } from '@utils/getEnv';
import type React from 'react';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import createVault from './createVaultWithRouterParams';

type FormData = {
  password: string;
  confirm: string;
};

const PasswordWay: React.FC<StackScreenProps<typeof PasswordWayStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      password: isDev ? '12345678' : '',
      confirm: isDev ? '12345678' : '',
    },
  });

  const [confirm, setConfirm] = useState(isDev);

  const _handleCreateVault = useCallback(async (data: FormData) => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      await plugins.Authentication.setPassword({ password: data.confirm });
      await new Promise((resolve) => setTimeout(() => resolve(null!), 20));
      if (await createVault(route.params, data.confirm)) {
        showMessage({ type: 'success', message: t('initWallet.msg.success') });
        navigation.navigate(HomeStackName);
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
      }
    } catch (err) {
      console.log('Init Wallet by password error: ', err);
      showMessage({ type: 'failed', message: t('initWallet.msg.failed'), description: String(err) ?? '' });
      navigation.navigate(HomeStackName);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
  }, []);

  const { inAsync, execAsync: handleCreateVault } = useInAsync(_handleCreateVault);

  return (
    <ScrollView contentContainerStyle={[{ minHeight: '100%', backgroundColor: colors.bgPrimary }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('initWallet.setPassword')}</Text>

        <Text style={[styles.description, { color: colors.textPrimary }]}>{t('initWallet.setPassword.describe')}</Text>

        <Text style={[styles.inputTitle, { color: colors.textPrimary }]}>{t('initWallet.setPassword.new')}</Text>
        <Controller
          control={control}
          rules={{
            required: true,
            minLength: 8,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput placeholder={t('common.password')} onBlur={onBlur} onChangeText={onChange} value={value} defaultHasValue={isDev} />
          )}
          name="password"
        />
        <Text style={[styles.inputError, { opacity: errors.password ? 1 : 0, color: colors.down }]}>{t('initWallet.setPassword.error.length')}</Text>

        <Text style={[styles.inputTitle, { color: colors.textPrimary, marginTop: 32 }]}>{t('initWallet.setPassword.confirm')}</Text>
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
            <TextInput placeholder={t('common.password')} onBlur={onBlur} onChangeText={onChange} value={value} defaultHasValue={isDev} />
          )}
          name="confirm"
        />
        <Text style={[styles.inputError, { opacity: errors.confirm ? 1 : 0, color: colors.down }]}>
          {errors.confirm?.type === 'validate' ? t('initWallet.setPassword.error.notMatch') : t('initWallet.setPassword.error.length')}
        </Text>

        <Pressable testID="checkbox" style={styles.rememberView} onPress={() => setConfirm((pre) => !pre)}>
          <Checkbox checked={confirm} pointerEvents="none" />
          <Text style={[styles.rememberText, { color: colors.textPrimary }]}>
            <Trans i18nKey={'initWallet.setPassword.check'}>
              BIM Wallet Wallet does not store your password. Please <Text style={{ color: colors.textNotice, fontWeight: '600' }}>remember</Text> your
              password.
            </Trans>
          </Text>
        </Pressable>

        <Button testID="createPasswordButton" style={styles.btn} onPress={handleSubmit(handleCreateVault)} disabled={!confirm} loading={inAsync}>
          {t('initWallet.setPassword.create')}
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'left',
  },
  description: {
    marginTop: 24,
    marginBottom: 32,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
  inputTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputError: {
    marginTop: 8,
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '300',
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
  btn: {
    marginTop: 24,
    marginBottom: 32,
  },
});

export default PasswordWay;
