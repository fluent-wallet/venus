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

  const runtimeRequestId = useMemo(() => route.params?.requestId ?? undefined, [route.params?.requestId]);

  const [inVerify, setInVerify] = useState(false);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState('');

  const handleCancel = useCallback(() => {
    if (runtimeRequestId) {
      getAuthService().cancelPasswordRequest({ requestId: runtimeRequestId });
    }

    setInVerify(false);
    setPassword(defaultPassword);
    setError('');
    setTimeout(() => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
    });
  }, [runtimeRequestId]);

  const handleConfirm = useCallback(async () => {
    if (!runtimeRequestId) {
      navigation.goBack();
      return;
    }

    setInVerify(true);
    await new Promise((resolve) => setTimeout(resolve, 25));

    if (navigation.canGoBack()) {
      navigation.goBack();
    }
    bottomSheetRef.current?.close();

    getAuthService().resolvePassword({ requestId: runtimeRequestId, password });

    setPassword(defaultPassword);
    setError('');
    setTimeout(() => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
    });

    setInVerify(false);
  }, [navigation, password, runtimeRequestId]);

  useEffect(() => {
    return () => {
      // Reject/cancel the request if the component is unmounted.
      if (runtimeRequestId) {
        getAuthService().cancelPasswordRequest({ requestId: runtimeRequestId });
      }
    };
  }, [runtimeRequestId]);

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
