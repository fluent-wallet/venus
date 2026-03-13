import {
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetHeader,
  type BottomSheetMethods,
  BottomSheetRoute,
  BottomSheetWrapper,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import { useTheme } from '@react-navigation/native';
import type { PasswordVerifyStackName, StackScreenProps } from '@router/configs';
import { getAuthService } from '@service/core';
import { screenHeight } from '@utils/deviceInfo';
import { isDev } from '@utils/getEnv';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, type TextInput as TextInputRef } from 'react-native';

const defaultPassword = isDev ? '12345678' : '';

const PasswordVerify: React.FC<StackScreenProps<typeof PasswordVerifyStackName>> = ({ navigation, route }) => {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const textInputRef = useRef<TextInputRef | null>(null);
  const bottomSheetRef = useRef<BottomSheetMethods | null>(null);
  const completedRef = useRef(false);
  const auth = getAuthService();

  const runtimeRequestId = useMemo(() => route.params?.requestId ?? undefined, [route.params?.requestId]);

  const [inVerify, setInVerify] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState('');

  const resetLocalState = useCallback(() => {
    setInVerify(false);
    setPassword(defaultPassword);
    setError('');
    setTimeout(() => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
    });
  }, []);

  const settleCancel = useCallback(() => {
    if (completedRef.current) return false;

    completedRef.current = true;
    if (runtimeRequestId) {
      auth.cancelPasswordRequest({ requestId: runtimeRequestId });
    }

    resetLocalState();
    return true;
  }, [auth, resetLocalState, runtimeRequestId]);

  const settleResolve = useCallback(
    (resolvedPassword: string) => {
      if (!runtimeRequestId || completedRef.current) return false;

      completedRef.current = true;
      auth.resolvePassword({ requestId: runtimeRequestId, password: resolvedPassword });
      resetLocalState();
      return true;
    },
    [auth, resetLocalState, runtimeRequestId],
  );

  const handleCancel = useCallback(() => {
    settleCancel();
  }, [settleCancel]);

  const handleConfirm = useCallback(async () => {
    if (!runtimeRequestId) {
      if (bottomSheetRef.current) {
        bottomSheetRef.current.close();
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
      return;
    }

    setInVerify(true);
    await new Promise((resolve) => setTimeout(resolve, 25));

    const isCorrectPassword = await auth.verifyPassword(password);
    if (!isCorrectPassword) {
      setError('Wrong password.');
      setInVerify(false);
      return;
    }

    if (settleResolve(password)) {
      if (bottomSheetRef.current) {
        bottomSheetRef.current.close();
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [auth, navigation, password, runtimeRequestId, settleResolve]);

  useEffect(() => {
    completedRef.current = false;
    return () => {
      // Reject/cancel the request if the component is unmounted.
      if (runtimeRequestId && !completedRef.current) {
        auth.cancelPasswordRequest({ requestId: runtimeRequestId });
      }
    };
  }, [auth, runtimeRequestId]);

  return (
    <BottomSheetRoute ref={bottomSheetRef} snapPoints={snapPoints} onClose={handleCancel} onOpen={() => textInputRef.current?.focus()}>
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
    </BottomSheetRoute>
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
