import BottomSheet, { BottomSheetView, BottomSheetTextInput, type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { stripHexPrefix } from '@core/utils/base';
import useInAsync from '@hooks/useInAsync';
import * as secp from '@noble/secp256k1';
import { useTheme } from '@react-navigation/native';
import { isAdjustResize, screenHeight } from '@utils/deviceInfo';
import { Mnemonic } from 'ethers';
/* eslint-disable react-hooks/exhaustive-deps */
import type React from 'react';
import { type RefObject, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, type TextInput, View } from 'react-native';
export type { BottomSheetMethods };

interface Props {
  bottomSheetRef: RefObject<BottomSheetMethods>;
  onSuccessConfirm?: (value: string) => void;
  inImporting?: boolean;
}

interface Status {
  type: 'success' | 'error';
  message: string;
}

const ImportExistingWallet: React.FC<Props> = ({ bottomSheetRef, inImporting, onSuccessConfirm }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const textInputRef = useRef<TextInput>(null!);
  const existWalletValueRef = useRef('');
  const [status, setStatus] = useState<Status | null>(null!);

  const _handleCheckInput = useCallback(() => {
    const value = String(existWalletValueRef.current).trim();
    let statusRes: Status;
    if (!value) {
      statusRes = { type: 'error', message: t('wallet.import.error.empty') };
    } else if (Mnemonic.isValidMnemonic(value)) {
      statusRes = { type: 'success', message: t('wallet.import.error.validPhrase') };
    } else if (secp.utils.isValidPrivateKey(stripHexPrefix(value))) {
      statusRes = { type: 'success', message: t('wallet.import.error.validPrivateKey') };
    } else {
      statusRes = { type: 'error', message: t('wallet.import.error.unknown') };
    }
    setStatus(statusRes);
    return statusRes;
  }, []);

  const { inAsync: inChecking, execAsync: handleCheckInput } = useInAsync(_handleCheckInput);

  const handleConfirm = useCallback(async () => {
    let _status = status;
    if (_status === null) {
      _status = await handleCheckInput();
    }
    if (_status?.type === 'success') {
      setTimeout(() => bottomSheetRef.current?.close(), 100);
      onSuccessConfirm?.(existWalletValueRef.current);
    }
  }, [status, onSuccessConfirm]);

  const handlePressBackdrop = useCallback(() => {
    if (!textInputRef.current) return;
    if (textInputRef.current.isFocused()) {
      textInputRef.current.blur();
    } else {
      bottomSheetRef.current?.close();
    }
  }, []);

  const handleOnChange = useCallback((index: number) => {
    if (index === -1) {
      setStatus(null);
    } else {
      textInputRef.current.focus();
    }
  }, []);

  const inAsync = inChecking || inImporting;
  return (
    <BottomSheet
      ref={bottomSheetRef}
      onChange={handleOnChange}
      backDropPressBehavior="collapse"
      handlePressBackdrop={handlePressBackdrop}
      snapPoints={snapPoints}
      enablePanDownToClose={!inAsync}
      enableContentPanningGesture={!inAsync}
      enableHandlePanningGesture={!inAsync}
      enableDynamicSizing
    >
      <BottomSheetView style={{ flex: 1 }}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
          }}
          style={styles.bottomSheetContainer}
          disabled={inAsync}
        >
          <BottomSheetTextInput
            ref={textInputRef as any}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderFourth }]}
            placeholderTextColor={colors.textSecondary}
            testID="existingWalletInput"
            underlineColorAndroid="transparent"
            secureTextEntry={true}
            multiline
            numberOfLines={6}
            placeholder={t('wallet.import.placeholder')}
            onChangeText={(value) => {
              setStatus(null);
              existWalletValueRef.current = value;
            }}
            onBlur={handleCheckInput}
            pointerEvents={inAsync ? 'none' : 'auto'}
          />
          <Text style={[styles.tipText, { color: status?.type === 'error' ? colors.down : colors.up, opacity: status === null ? 0 : 1 }]}>
            {status?.message || 'placeholder'}
          </Text>
          <Button testID="confirmImportExistingWallet" style={styles.btn} onPress={handleConfirm} loading={inAsync}>
            {t('common.confirm')}
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

const snapPoints = [`${(((isAdjustResize ? 400 : 306) / screenHeight) * 100).toFixed(2)}%`];

export default ImportExistingWallet;
