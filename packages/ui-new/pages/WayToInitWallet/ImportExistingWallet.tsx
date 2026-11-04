import Button from '@components/Button';
import Sheet, { SheetFooter, SheetHandle } from '@components/Sheet';
import Text from '@components/Text';
import { isValidPrivateKeyHex } from '@core/utils/secp256k1';
import useInAsync from '@hooks/useInAsync';
import { useTheme } from '@react-navigation/native';
import { isAdjustResize } from '@utils/deviceInfo';
import { Mnemonic } from 'ethers';
import type React from 'react';
import { type RefObject, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, TextInput } from 'react-native';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  inImporting?: boolean;
}

interface Status {
  type: 'success' | 'error';
  message: string;
}

const ImportExistingWallet: React.FC<Props> = ({ isOpen, ...props }) => {
  const { colors } = useTheme();
  const existWalletValueRef = useRef('');

  return (
    <Sheet isPresented={isOpen} height={{ height: isAdjustResize ? 400 : 306 }} containerColor={colors.bgFourth} onDismiss={props.onClose}>
      <ImportExistingWalletContent {...props} isOpen={isOpen} existWalletValueRef={existWalletValueRef} />
    </Sheet>
  );
};

function ImportExistingWalletContent({ existWalletValueRef, isOpen, inImporting, onConfirm, onClose }: Props & { existWalletValueRef: RefObject<string> }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [status, setStatus] = useState<Status | null>(null);

  const _handleCheckInput = useCallback(() => {
    const value = String(existWalletValueRef.current).trim();
    let statusRes: Status;
    if (!value) {
      statusRes = { type: 'error', message: t('wallet.import.error.empty') };
    } else if (Mnemonic.isValidMnemonic(value)) {
      statusRes = { type: 'success', message: t('wallet.import.error.validPhrase') };
    } else if (isValidPrivateKeyHex(value)) {
      statusRes = { type: 'success', message: t('wallet.import.error.validPrivateKey') };
    } else {
      statusRes = { type: 'error', message: t('wallet.import.error.unknown') };
    }
    setStatus(statusRes);
    return statusRes;
  }, [existWalletValueRef, t]);

  const { inAsync: inChecking, execAsync: handleCheckInput } = useInAsync(_handleCheckInput);

  const handleConfirm = useCallback(async () => {
    if (!isOpen) return;
    let _status = status;
    if (_status === null) {
      _status = await handleCheckInput();
    }
    if (_status?.type === 'success') {
      Keyboard.dismiss();
      onClose();
      onConfirm(existWalletValueRef.current);
    }
  }, [isOpen, status, handleCheckInput, existWalletValueRef, onClose, onConfirm]);

  const inAsync = inChecking || inImporting;
  return (
    <>
      <SheetHandle />
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
        }}
        style={styles.pressable}
        disabled={inAsync}
      >
        <TextInput
          autoFocus
          defaultValue={existWalletValueRef.current}
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
      </Pressable>
      <SheetFooter>
        <Button testID="confirmImportExistingWallet" onPress={handleConfirm} loading={inAsync} disabled={!isOpen}>
          {t('common.confirm')}
        </Button>
      </SheetFooter>
    </>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
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
});

export default ImportExistingWallet;
