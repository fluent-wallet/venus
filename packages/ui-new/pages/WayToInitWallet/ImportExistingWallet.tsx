/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useState, useCallback, type RefObject } from 'react';
import { Pressable, Keyboard, StyleSheet, type TextInput } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Mnemonic } from 'ethers';
import * as secp from '@noble/secp256k1';
import { stripHexPrefix } from '@core/utils/base';
import useInAsync from '@hooks/useInAsync';
import Button from '@components/Button';
import Text from '@components/Text';
import BottomSheet, { BottomSheetView, BottomSheetTextInput, type BottomSheetMethods } from '@components/BottomSheetNew';
import { screenHeight } from '@utils/deviceInfo';
export { BottomSheetMethods };

interface Props {
  bottomSheetRef: RefObject<BottomSheetMethods>;
  onSuccessConfirm?: (value: string) => void;
  isModal: boolean;
}

interface Status {
  type: 'success' | 'error';
  message: string;
}

const ImportExistingWallet: React.FC<Props> = ({ bottomSheetRef, onSuccessConfirm, isModal }) => {
  const { colors } = useTheme();

  const textInputRef = useRef<TextInput>(null!);
  const existWalletValueRef = useRef('');
  const [status, setStatus] = useState<Status | null>(null!);

  const _handleCheckInput = useCallback(() => {
    const value = String(existWalletValueRef.current).trim();
    let statusRes: Status;
    if (!value) {
      statusRes = { type: 'error', message: 'Input cannot be empty' };
    } else if (Mnemonic.isValidMnemonic(value)) {
      statusRes = { type: 'success', message: 'Valid seed phrase' };
    } else if (secp.utils.isValidPrivateKey(stripHexPrefix(value))) {
      statusRes = { type: 'success', message: 'Valid private key' };
    } else {
      statusRes = { type: 'error', message: 'Invalid seed phrase or private key' };
    }
    setStatus(statusRes);
    return statusRes;
  }, []);

  const { inAsync, execAsync: handleCheckInput } = useInAsync(_handleCheckInput);

  const handleConfirm = useCallback(async () => {
    let _status = status;
    if (_status === null) {
      _status = await handleCheckInput();
    }
    if (_status?.type === 'success') {
      Keyboard.dismiss();
      setTimeout(() => bottomSheetRef.current?.close(), 100);
      onSuccessConfirm?.(existWalletValueRef.current);
    }
  }, [isModal, status, onSuccessConfirm]);

  const handlePressBackdrop = useCallback(() => {
    console.log('handlePressBackdrop');
    if (!textInputRef.current) return;
    if (textInputRef.current.isFocused()) {
      textInputRef.current.blur();
    } else {
      bottomSheetRef.current?.close();
    }
  }, []);

  const handleOnChange = useCallback(
    (index: number) => {
      if (index === -1) {
        setStatus(null);
      } else {
        textInputRef.current.focus();
      }
    },
    [isModal],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      onChange={handleOnChange}
      backDropPressBehavior="collapse"
      handlePressBackdrop={handlePressBackdrop}
      snapPoints={snapPoints}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
          }}
          style={styles.bottomSheetContainer}
        >
          <BottomSheetTextInput
            ref={textInputRef as any}
            style={[styles.input, { color: colors.textPrimary }]}
            placeholderTextColor={colors.textSecondary}
            testID="existingWalletInput"
            underlineColorAndroid="transparent"
            secureTextEntry={true}
            editable
            multiline
            numberOfLines={6}
            placeholder="Enter your seed phrase which words separated by space or private key"
            onChangeText={(value) => {
              setStatus(null);
              existWalletValueRef.current = value;
            }}
            onBlur={handleCheckInput}
          />
          <Text style={[styles.tipText, { color: status?.type === 'error' ? colors.down : colors.up, opacity: status === null ? 0 : 1 }]}>
            {status?.message || 'placeholder'}
          </Text>
          <Button testID="confirmImportExistingWallet" style={styles.btn} onPress={handleConfirm} loading={inAsync}>
            Confirm
          </Button>
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  bottomSheetContainer: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32,
  },
  input: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
  },
  tipText: {
    width: '100%',
    marginTop: 8,
    marginBottom: 'auto',
    fontSize: 12,
    textAlign: 'left',
  },
  btn: {
    width: '100%',
  },
});

const snapPoints = [`${((360 / screenHeight) * 100).toFixed(2)}%`];

export default ImportExistingWallet;
