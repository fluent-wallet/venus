import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import plugins from '@core/WalletCore/Plugins';
import { useTheme } from '@react-navigation/native';
import Button from '@components/Button';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { isDev } from '@utils/getEnv';
import { type PasswordRequest } from '@WalletCoreExtends/Plugins/Authentication';

const defaultPassword = isDev ? '12345678' : '';

const PasswordVerify: React.FC = () => {
  const { colors } = useTheme();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const [inVerify, setInVerify] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState('');

  const currentRequest = useRef<PasswordRequest | null>(null);

  useEffect(() => {
    const subscription = plugins.Authentication.passwordRequestSubject.subscribe({
      next: (request) => {
        bottomSheetRef.current?.present();
        currentRequest.current = request;
      },
    });

    return () => {
      setInVerify(false);
      subscription.unsubscribe();
    };
  }, []);

  const handleCancel = useCallback(() => {
    bottomSheetRef.current?.dismiss();
    setInVerify(false);
    setPassword(defaultPassword);
    setError('');
    currentRequest.current?.reject?.('cancel');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!currentRequest.current) return;
    setInVerify(true);
    const isCorrectPasword = await currentRequest.current?.verify?.(password);
    if (isCorrectPasword) {
      currentRequest.current?.resolve?.(password);
      bottomSheetRef.current?.dismiss();
      setPassword(defaultPassword);
      setError('');
      currentRequest.current = null;
    } else {
      setError('Wrong password.');
    }
    setInVerify(false);
  }, [password]);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onDismiss={handleCancel}>
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

const snapPoints = ['33.5%'];

export default PasswordVerify;
