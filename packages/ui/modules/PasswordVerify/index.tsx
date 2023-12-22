import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, useTheme } from '@rneui/themed';
import { BaseButton } from '@components/Button';
import plugins from '@core/WalletCore/Plugins';
import Password from '@components/PasswordInput';
import { type PasswordRequest } from '@WalletCoreExtends/Plugins/Authentication';

const PasswordVerify: React.FC = () => {
  const { theme } = useTheme();

  const [visible, setVisible] = useState(false);
  const [inVerify, setInVerify] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const currentRequest = useRef<PasswordRequest | null>(null);

  useEffect(() => {
    const subscription = plugins.Authentication.passwordRequestSubject.subscribe({
      next: (request) => {
        setVisible(true);
        currentRequest.current = request;
      },
    });

    return () => {
      setVisible(false);
      setInVerify(false);
      subscription.unsubscribe();
    };
  }, []);

  const handleCancel = useCallback(() => {
    setVisible(false);
    setInVerify(false);
    setPassword('');
    setError('');
    currentRequest.current?.reject?.();
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!currentRequest.current) return;
    setInVerify(true);
    const isCorrectPasword = await currentRequest.current?.verify?.(password);
    if (isCorrectPasword) {
      currentRequest.current?.resolve?.(password);
      setVisible(false);
      setPassword('');
      setError('');
      currentRequest.current = null;
    } else {
      setError('Wrong assword.');
    }
    setInVerify(false);
  }, [password]);

  return (
    <BottomSheet isVisible={visible} onBackdropPress={handleCancel}>
      <View className="h-[240px] rounded-t-[16px] px-[24px] pt-[12px]" style={{ backgroundColor: theme.colors.surfaceCard }}>
        <Password
          errorMessage={error}
          errorMessagePlaceholder
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError('');
          }}
          title="Verify Password"
          onBlur={handleConfirm}
        />
        <BaseButton loading={inVerify} onPress={handleConfirm} disabled={!password}>
          Confirm
        </BaseButton>
      </View>
    </BottomSheet>
  );
};

export default PasswordVerify;
