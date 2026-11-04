import Button from '@components/Button';
import { SheetBody, SheetFooter, SheetHeader, SheetScrollView } from '@components/Sheet';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import { useTheme } from '@react-navigation/native';
import type { PasswordVerifyStackName, StackScreenProps } from '@router/configs';
import { getAuthService } from '@service/core';
import { isDev } from '@utils/getEnv';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, type TextInputInstance as TextInputRef } from 'react-native';

const defaultPassword = isDev ? '12345678' : '';

const PasswordVerify: React.FC<StackScreenProps<typeof PasswordVerifyStackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const textInputRef = useRef<TextInputRef | null>(null);
  const verifying = useRef(false);
  const requestSettledRef = useRef(false);
  const auth = getAuthService();
  const requestId = route.params?.requestId;

  const [inVerify, setInVerify] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState('');

  const handleConfirm = useCallback(async () => {
    if (verifying.current || requestSettledRef.current) return;
    if (!requestId) {
      if (navigation.canGoBack()) navigation.goBack();
      return;
    }

    verifying.current = true;
    setInVerify(true);
    try {
      const correct = await auth.verifyPassword(password);
      if (!verifying.current) return;
      if (!correct) {
        setError('Wrong password.');
        return;
      }
      requestSettledRef.current = true;
      Keyboard.dismiss();
      navigation.goBack();
      auth.resolvePassword({ requestId, password });
    } catch (error) {
      if (verifying.current && !requestSettledRef.current) {
        requestSettledRef.current = true;
        navigation.goBack();
        auth.rejectPasswordRequest({ requestId, error });
      }
    } finally {
      if (verifying.current) {
        verifying.current = false;
        setInVerify(false);
      }
    }
  }, [auth, requestId, password, navigation]);

  useEffect(
    () => () => {
      verifying.current = false;
      if (!requestId || requestSettledRef.current) return;
      requestSettledRef.current = true;
      auth.cancelPasswordRequest({ requestId });
    },
    [auth, requestId],
  );

  useEffect(() => {
    return navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) textInputRef.current?.focus();
    });
  }, [navigation]);

  return (
    <>
      <SheetHeader title={t('common.verifyPassword')} />
      <SheetScrollView>
        <SheetBody>
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
            disabled={inVerify}
          />
          <Text style={[styles.error, { color: colors.down, opacity: !error ? 0 : 1 }]}>{error || 'placeholder'}</Text>
        </SheetBody>
        <SheetFooter>
          <Button testID="confirm" loading={inVerify} onPress={handleConfirm} disabled={!password}>
            {t('common.confirm')}
          </Button>
        </SheetFooter>
      </SheetScrollView>
    </>
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

export default PasswordVerify;
