import React, { useState, useCallback } from 'react';
import { ScrollView, KeyboardAvoidingView, Pressable, StyleSheet } from 'react-native';
import { useTheme, CommonActions } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import { useForm, Controller } from 'react-hook-form';
import plugins from '@core/WalletCore/Plugins';
import useInAsync from '@hooks/useInAsync';
import Text from '@components/Text';
import Button from '@components/Button';
import TextInput from '@components/TextInput';
import Checkbox from '@components/Checkbox';
import { isDev } from '@utils/getEnv';
import { PasswordWayStackName, HomeStackName, type StackScreenProps } from '@router/configs';
import createVault from './createVaultWithRouterParams';

type FormData = {
  password: string;
  confirm: string;
};

const PasswordWay: React.FC<StackScreenProps<typeof PasswordWayStackName>> = ({ navigation, route }) => {
  const { colors } = useTheme();

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
        showMessage({ type: 'success', message: 'You’ve successfully protected wallet. Remember to keep your Password, it’s your responsibility!' });
        navigation.navigate(HomeStackName);
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
      }
    } catch (err) {
      console.log('Init Wallet by password error: ', err);
      showMessage({ type: 'failed', message: 'Create wallet failed!', description: String(err) ?? '' });
      navigation.navigate(HomeStackName);
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
  }, []);

  const { inAsync, execAsync: handleCreateVault } = useInAsync(_handleCreateVault);

  return (
    <KeyboardAvoidingView style={styles.keyboardView}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>🔐 Set Password</Text>

        <Text style={[styles.description, { color: colors.textPrimary }]}>Add security verification to ensure the safety of your funds.</Text>

        <Text style={[styles.inputTitle, { color: colors.textPrimary }]}>New Password</Text>
        <Controller
          control={control}
          rules={{
            required: true,
            minLength: 8,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput placeholder="Password" onBlur={onBlur} onChangeText={onChange} value={value} defaultHasValue={isDev} />
          )}
          name="password"
        />
        <Text style={[styles.inputError, { opacity: errors.password ? 1 : 0, color: colors.down }]}>Must be at least 8 characters.</Text>

        <Text style={[styles.inputTitle, { color: colors.textPrimary, marginTop: 32 }]}>Confirm New Password</Text>
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
            <TextInput placeholder="Password" onBlur={onBlur} onChangeText={onChange} value={value} defaultHasValue={isDev} />
          )}
          name="confirm"
        />
        <Text style={[styles.inputError, { opacity: errors.confirm ? 1 : 0, color: colors.down }]}>
          {errors.confirm?.type === 'validate' ? 'Password must be match.' : 'Must be at least 8 characters.'}
        </Text>

        <Pressable style={styles.rememberView} onPress={() => setConfirm((pre) => !pre)}>
          <Checkbox checked={confirm} pointerEvents="none" />
          <Text style={[styles.rememberText, { color: colors.textPrimary }]}>
            ePay Wallet does not store your password.
            {'\n'}
            Please <Text style={{ color: colors.textNotice, fontWeight: '600' }}>remember</Text> your password.
          </Text>
        </Pressable>

        <Button
          testID="createPasswordButton"
          style={styles.btn}
          mode="auto"
          size="small"
          onPress={handleSubmit(handleCreateVault)}
          disabled={!confirm}
          loading={inAsync}
        >
          Create Password
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
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
