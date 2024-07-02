import type { PasswordRequest } from '@WalletCoreExtends/Plugins/Authentication';
import BottomSheet, { BottomSheetWrapper, BottomSheetHeader, BottomSheetContent, BottomSheetFooter, type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import plugins from '@core/WalletCore/Plugins';
import { useTheme } from '@react-navigation/native';
import type { PasswordVerifyStackName, StackScreenProps } from '@router/configs';
import { screenHeight } from '@utils/deviceInfo';
import { isDev } from '@utils/getEnv';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, type TextInput as TextInputRef } from 'react-native';

const defaultPassword = isDev ? '12345678' : '';

const PasswordVerify: React.FC<StackScreenProps<typeof PasswordVerifyStackName>> = ({ navigation }) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const textInputRef = useRef<TextInputRef>(null!);
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const [inVerify, setInVerify] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState('');

  const currentRequest = useRef<PasswordRequest | null>(null);

  useEffect(() => {
    const sub = plugins.Authentication.subPasswordRequest().subscribe((request) => {
      currentRequest.current = request;
      // the request is received, so we can clear the event
      plugins.Authentication.clearPasswordRequest();
    });
    return () => {
      setInVerify(false);
      // if the request is still not resolved, we should reject it
      if (currentRequest.current) {
        currentRequest.current.reject();
      }
      sub.unsubscribe();
    };
  }, []);

  const handleCancel = useCallback(() => {
    currentRequest.current?.reject?.('cancel');
    setInVerify(false);
    setPassword(defaultPassword);
    setError('');
    setTimeout(() => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!currentRequest.current) return;
    setInVerify(true);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const isCorrectPasword = await currentRequest.current?.verify?.(password);
    if (isCorrectPasword) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
      bottomSheetRef.current?.close();
      currentRequest.current?.resolve?.(password);
      setPassword(defaultPassword);
      setError('');
      currentRequest.current = null;
      setTimeout(() => {
        if (Keyboard.isVisible()) {
          Keyboard.dismiss();
        }
      });
    } else {
      setError('Wrong password.');
    }
    setInVerify(false);
  }, [password]);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onClose={handleCancel} isRoute onOpen={() => textInputRef.current?.focus()}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('common.verifyPassword')} />
        <BottomSheetContent>
          <TextInput
            containerStyle={{ marginTop: 16, borderWidth: mode === 'dark' ? 1 : 0, borderColor: colors.borderFourth }}
            ref={textInputRef}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError('');
            }}
            onSubmitEditing={handleConfirm}
            isInBottomSheet
          />
          <Text style={[styles.error, { color: colors.down, opacity: !error ? 0 : 1 }]}>{error || 'placeholder'}</Text>
        </BottomSheetContent>
        <BottomSheetFooter>
          <Button testID="confirm" loading={inVerify} onPress={handleConfirm} disabled={!password}>
            {t('common.confirm')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  error: {
    width: '100%',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'left',
  },
});

const snapPoints = [`${((348 / screenHeight) * 100).toFixed(2)}%`];

export default PasswordVerify;
