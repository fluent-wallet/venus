import React, { useState } from 'react';
import { ScrollView, KeyboardAvoidingView, View, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import Text from '@components/Text';
import Button from '@components/Button';
import TextInput from '@components/TextInput';
import Checkbox from '@components/Checkbox';
import { isDev } from '@utils/getEnv';
import { PasswordWayStackName, type StackScreenProps } from '@router/configs';

type FormData = {
  password: string;
  confirm: string;
};

const PasswordWay: React.FC<StackScreenProps<typeof PasswordWayStackName>> = ({ navigation }) => {
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
  const onSubmit = (data: FormData) => console.log(data);

  const [confirm, setConfirm] = useState(isDev);

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
          render={({ field: { onChange, onBlur, value } }) => <TextInput placeholder="Password" onBlur={onBlur} onChangeText={onChange} value={value} />}
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
          render={({ field: { onChange, onBlur, value } }) => <TextInput placeholder="Password" onBlur={onBlur} onChangeText={onChange} value={value} />}
          name="confirm"
        />
        <Text style={[styles.inputError, { opacity: errors.confirm ? 1 : 0, color: colors.down }]}>
          {errors.confirm?.type === 'validate' ? 'Password must be match.' : 'Must be at least 8 characters.'}
        </Text>

        <TouchableWithoutFeedback onPress={() => setConfirm(pre => !pre)}>
          <View style={styles.rememberView}>
            <Checkbox checked={confirm} pointerEvents='none'/>
            <Text style={[styles.rememberText, { color: colors.textPrimary }]}>
              ePay Wallet does not store your password.
              {'\n'}
              Please <Text style={{ color: colors.textNotice, fontWeight: '600' }}>remember</Text> your password.
            </Text>
          </View>
        </TouchableWithoutFeedback>

        <Button testID="createPasswordButton" style={styles.btn} mode="auto" onPress={handleSubmit(onSubmit)} disabled={!confirm}>
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
