import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import plugins from '@core/WalletCore/Plugins';
import { useTheme } from '@react-navigation/native';
import Button from '@components/Button';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheetNew';
import { PasswordVerifyStackName, type StackScreenProps } from '@router/configs';
import { isDev } from '@utils/getEnv';
import { screenHeight } from '@utils/deviceInfo';
import { type PasswordRequest } from '@WalletCoreExtends/Plugins/Authentication';

const defaultPassword = isDev ? '12345678' : '';

const PasswordVerify: React.FC<StackScreenProps<typeof PasswordVerifyStackName>> = ({ navigation }) => {
  const { colors } = useTheme();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const [inVerify, setInVerify] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState('');

  const currentRequest = useRef<PasswordRequest | null>(null);

  useEffect(() => {
    const subscription = plugins.Authentication.passwordRequestSubject.subscribe({
      next: (request) => {
        if (!request) return;
        currentRequest.current = request;
      },
    });
    return () => {
      setInVerify(false);
      subscription.unsubscribe();
    };
  }, []);

  const handleCancel = useCallback(() => {
    currentRequest.current?.reject?.('cancel');
    setInVerify(false);
    setPassword(defaultPassword);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!currentRequest.current) return;
    setInVerify(true);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const isCorrectPasword = await currentRequest.current?.verify?.(password);
    if (isCorrectPasword) {
      navigation.goBack();
      bottomSheetRef.current?.close();
      currentRequest.current?.resolve?.(password);
      setPassword(defaultPassword);
      setError('');
      currentRequest.current = null;
    } else {
      setError('Wrong password.');
    }
    setInVerify(false);
  }, [password]);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onClose={handleCancel} isRoute>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Verify Password</Text>
        <TextInput
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError('');
          }}
          onSubmitEditing={handleConfirm}
          isInBottomSheet
          autoFocus
        />
        <Text style={[styles.error, { color: colors.down, opacity: !error ? 0 : 1 }]}>{error || 'placeholder'}</Text>
        <Button testID="confirm" loading={inVerify} onPress={handleConfirm} disabled={!password} style={styles.btn}>
          Confirm
        </Button>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    marginBottom: 16,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  error: {
    width: '100%',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'left',
  },
  btn: {
    marginTop: 'auto',
  },
});

const snapPoints = [`${((360 / screenHeight) * 100).toFixed(2)}%`];

export default PasswordVerify;
