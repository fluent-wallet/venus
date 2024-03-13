/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useState, useCallback, type MutableRefObject } from 'react';
import { Pressable, Keyboard, StyleSheet, type TextInput } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Mnemonic } from 'ethers';
import * as secp from '@noble/secp256k1';
import { stripHexPrefix } from '@core/utils/base';
import useInAsync from '@hooks/useInAsync';
import Button from '@components/Button';
import Text from '@components/Text';
import BottomSheet, { BottomSheetTextInput, type BottomSheetMethods } from '@components/BottomSheet';
import { screenHeight } from '@utils/deviceInfo';
export { type BottomSheetMethods };

interface Props {
  bottomSheetRef: MutableRefObject<BottomSheetMethods>;
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
      if (isModal) {
        setTimeout(() => bottomSheetRef.current?.dismiss(), 100);
      } else {
        setTimeout(() => bottomSheetRef.current?.close(), 100);
      }
      onSuccessConfirm?.(existWalletValueRef.current);
    }
  }, [isModal, status, onSuccessConfirm]);

  const handlePressBackdrop = useCallback(() => {
    if (!textInputRef.current) return;
    if (textInputRef.current.isFocused()) {
      textInputRef.current.blur();
    } else {
      bottomSheetRef.current?.close();
    }
  }, []);

  const handleClose = useCallback(() => {
    setStatus(null);
  }, []);
  const handleOnChange = useCallback(
    (index: number) => {
      if ((isModal && index === 1) || (!isModal && index === 0)) {
        textInputRef.current?.focus();
      } else {
        if (!isModal && index === -1) {
          handleClose();
        }
      }
    },
    [isModal],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onChange={handleOnChange}
      onDismiss={isModal ? handleClose : undefined}
      backDropPressBehavior="collapse"
      handlePressBackdrop={handlePressBackdrop}
      isModal={isModal}
    >
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
        }}
        style={styles.bottomSheetContainer}
      >
        <BottomSheetTextInput
          ref={textInputRef as any}
          style={[styles.input, { color: colors.textPrimary }]}
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

const snapPoints = [`${((310 / screenHeight) * 100).toFixed(2)}%`];

export default ImportExistingWallet;
