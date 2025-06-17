import BottomSheet, { BottomSheetWrapper, BottomSheetHeader, BottomSheetContent, BottomSheetFooter, type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import plugins from '@core/WalletCore/Plugins';
import { useTheme } from '@react-navigation/native';
import type { PasswordVerifyStackName, StackScreenProps } from '@router/configs';
import { screenHeight } from '@utils/deviceInfo';
import { isDev } from '@utils/getEnv';
import { passwordRequestCanceledError } from '@WalletCoreExtends/Plugins/Authentication/errors';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, type TextInput as TextInputRef } from 'react-native';

const defaultPassword = isDev ? '12345678' : '';

const PasswordVerify: React.FC<StackScreenProps<typeof PasswordVerifyStackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const textInputRef = useRef<TextInputRef>(null!);
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const [inVerify, setInVerify] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState('');

  const handleCancel = useCallback(() => {
    plugins.Authentication.reject({ id: route.params.id, error: passwordRequestCanceledError() });
    setInVerify(false);
    setPassword(defaultPassword);
    setError('');
    setTimeout(() => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
    });
  }, [route.params.id]);

  const handleConfirm = useCallback(async () => {
    setInVerify(true);
    const isCorrectPassword = await plugins.Authentication.verifyPassword(password);
    if (isCorrectPassword) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
      bottomSheetRef.current?.close();
      plugins.Authentication.resolve({ id: route.params.id, password });

      setPassword(defaultPassword);
      setError('');
      setTimeout(() => {
        if (Keyboard.isVisible()) {
          Keyboard.dismiss();
        }
      });
    } else {
      setError('Wrong password.');
    }
    setInVerify(false);
  }, [password, route.params.id, navigation]);

  useEffect(() => {
    return () => {
      // reject the request if the component is unmounted or id changes
      plugins.Authentication.reject({ id: route.params.id, error: passwordRequestCanceledError() });
    };
  }, [route.params.id]);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} onClose={handleCancel} isRoute onOpen={() => textInputRef.current?.focus()}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('common.verifyPassword')} />
        <BottomSheetContent>
          <TextInput
            containerStyle={{ marginTop: 16, borderWidth: mode === 'dark' ? 1 : 0, borderColor: colors.borderFourth }}
            testID="password"
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
