import {
  BottomSheetContent,
  BottomSheetFooter,
  type BottomSheetMethods,
  BottomSheetTextInput,
  BottomSheetWrapper,
  InlineBottomSheet,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import useInAsync from '@hooks/useInAsync';
import { useTheme } from '@react-navigation/native';
import { type ImportWalletCreationRequest, resolveImportWalletRequest } from '@service/walletCreation';
import { isAdjustResize, screenHeight } from '@utils/deviceInfo';
/* eslint-disable react-hooks/exhaustive-deps */
import type React from 'react';
import { type RefObject, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, type TextInput } from 'react-native';

interface Props {
  bottomSheetRef: RefObject<BottomSheetMethods>;
  onSuccessConfirm?: (request: ImportWalletCreationRequest) => void;
  inImporting?: boolean;
}

type Status = { type: 'success'; message: string; request: ImportWalletCreationRequest } | { type: 'error'; message: string };

const ImportExistingWallet: React.FC<Props> = ({ bottomSheetRef, inImporting, onSuccessConfirm }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const textInputRef = useRef<TextInput>(null!);
  const existWalletValueRef = useRef('');
  const [status, setStatus] = useState<Status | null>(null!);

  const _handleCheckInput = useCallback(() => {
    const resolvedImportRequest = resolveImportWalletRequest(existWalletValueRef.current);
    let statusRes: Status;

    if (resolvedImportRequest.status === 'empty') {
      statusRes = { type: 'error', message: t('wallet.import.error.empty') };
    } else if (resolvedImportRequest.status === 'invalid') {
      statusRes = { type: 'error', message: t('wallet.import.error.unknown') };
    } else {
      statusRes = {
        type: 'success',
        message: resolvedImportRequest.request.kind === 'import_mnemonic' ? t('wallet.import.error.validPhrase') : t('wallet.import.error.validPrivateKey'),
        request: resolvedImportRequest.request,
      };
    }

    setStatus(statusRes);
    return statusRes;
  }, [t]);

  const { inAsync: inChecking, execAsync: handleCheckInput } = useInAsync(_handleCheckInput);

  const handleConfirm = useCallback(async () => {
    let nextStatus = status;
    if (nextStatus === null) {
      nextStatus = await handleCheckInput();
    }

    if (nextStatus?.type === 'success') {
      setTimeout(() => bottomSheetRef.current?.close(), 100);
      onSuccessConfirm?.(nextStatus.request);
    }
  }, [bottomSheetRef, handleCheckInput, onSuccessConfirm, status]);

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
    <InlineBottomSheet
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
      <BottomSheetWrapper useBottomSheetView={true}>
        <BottomSheetContent>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
            }}
            style={styles.pressable}
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
          </Pressable>
        </BottomSheetContent>
        <BottomSheetFooter innerPaddingHorizontal>
          <Button testID="confirmImportExistingWallet" onPress={handleConfirm} loading={inAsync}>
            {t('common.confirm')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </InlineBottomSheet>
  );
};

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

const snapPoints = [`${(((isAdjustResize ? 400 : 306) / screenHeight) * 100).toFixed(2)}%`];

export default ImportExistingWallet;
