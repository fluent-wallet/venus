/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useState, useCallback, type MutableRefObject } from 'react';
import { View, TouchableWithoutFeedback, Keyboard, StyleSheet, type TextInput } from 'react-native';
import { useTheme } from '@react-navigation/native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetTextInput, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Mnemonic } from 'ethers';
import * as secp from '@noble/secp256k1';
import { stripHexPrefix } from '@core/utils/base';
import useInAsync from '@hooks/useInAsync';
import Button from '@components/Button';
import Text from '@components/Text';
export { type BottomSheet };

interface Props {
  bottomSheetRef: MutableRefObject<BottomSheet>;
  onSuccessConfirm?: (value: string) => void;
}

interface Status {
  type: 'success' | 'error';
  message: string;
}

const AccountSelector: React.FC<Props> = ({ bottomSheetRef, onSuccessConfirm }) => {
  const { colors, palette } = useTheme();

  const textInputRef = useRef<TextInput>(null!);
  const existWalletValueRef = useRef('');
  const [status, setStatus] = useState<Status | null>(null!);

  const _handleCheckInput = useCallback(() => {
    const value = String(existWalletValueRef.current).trim();
    let status: Status;
    if (!value) {
      status = { type: 'error', message: 'Input cannot be empty' };
    } else if (Mnemonic.isValidMnemonic(value)) {
      status = { type: 'success', message: 'Valid seed phrase' };
    } else if (secp.utils.isValidPrivateKey(stripHexPrefix(value))) {
      status = { type: 'success', message: 'Valid private key' };
    } else {
      status = { type: 'error', message: 'Invalid seed phrase or private key' };
    }
    setStatus(status);
    return status;
  }, []);

  const { inAsync, execAsync: handleCheckInput } = useInAsync(_handleCheckInput);

  const handleConfirm = useCallback(() => {
    let _status = status;
    if (_status === null) {
      _status = handleCheckInput();
    }
    if (_status?.type === 'success') {
      bottomSheetRef.current?.close();
      setTimeout(() => bottomSheetRef.current?.close(), 100);
      Keyboard.dismiss();
      onSuccessConfirm?.(existWalletValueRef.current);
    }
  }, [status, handleCheckInput, onSuccessConfirm]);

  const handleClickBackdrop = useCallback(() => {
    if (!textInputRef.current) return;
    if (textInputRef.current.isFocused()) {
      textInputRef.current.blur();
    } else {
      bottomSheetRef.current?.close();
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="collapse" onPress={handleClickBackdrop} />
    ),
    [],
  );

  const handleClose = useCallback(() => {
    setStatus(null);
  }, []);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      keyboardBlurBehavior="restore"
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={handleClose}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
        }}
      >
        <View style={styles.bottomSheetContainer}>
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
          <Text style={[styles.tipText, { color: status?.type === 'error' ? palette.red4 : 'green', opacity: status === null ? 0 : 1 }]}>
            {status?.message || 'placeholder'}
          </Text>
          <Button testID="confirmImportExistingWallet" style={styles.btn} onPress={handleConfirm} loading={inAsync}>
            Confirm
          </Button>
        </View>
      </TouchableWithoutFeedback>
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
  },
  input: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    justifyContent: 'flex-start',
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
    marginBottom: 40,
  },
});

const snapPoints = ['45%'];

export default AccountSelector;
