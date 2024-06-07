/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { memo, useMemo, useCallback, useState, useRef, type ComponentProps, useEffect } from 'react';
import { View, Pressable, StyleSheet, Keyboard } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useForm, Controller, type SubmitErrorHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'react-native-flash-message';
import Decimal from 'decimal.js';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import _TextInput from '@components/TextInput';
import ArrowRight from '@assets/icons/arrow-right2.svg';
import Warning from '@assets/icons/warn.svg';
import { type SelectedGasEstimate } from './index';

interface Props {
  customizeEstimate: SelectedGasEstimate;
  onConfirm: (customizeEstimate: SelectedGasEstimate) => void;
  onClose: () => void;
}

const GweiSuffix = memo(() => {
  const { colors } = useTheme();
  return <Text style={[styles.gwei, { color: colors.textPrimary }]}>Gwei</Text>;
});

const TextInput: React.FC<ComponentProps<typeof _TextInput> & { colors: ReturnType<typeof useTheme>['colors']; showGweiSuffix?: boolean }> = ({
  colors,
  keyboardType = 'numeric',
  defaultHasValue = true,
  showVisible = false,
  isInBottomSheet = true,
  showGweiSuffix = true,
  ...props
}) => (
  <_TextInput
    {...props}
    containerStyle={[styles.textinput, { borderColor: colors.borderFourth }]}
    keyboardType={keyboardType}
    defaultHasValue={defaultHasValue}
    showVisible={showVisible}
    isInBottomSheet={isInBottomSheet}
    SuffixIcon={showGweiSuffix ? <GweiSuffix /> : undefined}
  />
);

type FormData = {
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasLimit: string;
  nonce: string;
};

const controlRule = {
  required: true,
  pattern: /^[0-9]*\.?[0-9]+$/,
  validate: (value: string) => parseFloat(value) > 0 || 'should be greater than 0',
};

const CustomizeSetting: React.FC<Props> = ({ customizeEstimate, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const bottomSheetIndexRef = useRef(0);
  const [showAdvance, setShowAdvance] = useState(() => false);

  const { control, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      gasPrice: new Decimal(customizeEstimate.suggestedGasPrice ?? 0).div(1e9).toString(),
      maxFeePerGas: new Decimal(customizeEstimate.suggestedMaxFeePerGas ?? 0).div(1e9).toString(),
      maxPriorityFeePerGas: '0',
      gasLimit: new Decimal(customizeEstimate.gasLimit ?? 21000).toString(),
      nonce: String(customizeEstimate.nonce ?? ''),
    },
  });
  const gasPriceInputVal = watch('gasPrice');
  const maxFeePerGasInputVal = watch('maxFeePerGas');

  const currentPriceGwei = useMemo(() => new Decimal(customizeEstimate.gasPrice).div(1e9).toString(), [customizeEstimate.gasPrice]);
  const isTooLow = useMemo(
    () => parseFloat(customizeEstimate.suggestedMaxFeePerGas ? maxFeePerGasInputVal : gasPriceInputVal) < parseFloat(currentPriceGwei),
    [maxFeePerGasInputVal, gasPriceInputVal, currentPriceGwei],
  );

  const handleTriggerAdvance = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(Number(!showAdvance));
    setShowAdvance((pre) => !pre);
    if (Keyboard.isVisible()) {
      setTimeout(() => Keyboard.dismiss(), 250);
    }
  }, [showAdvance]);

  const handleConfirm = useCallback(
    (data: FormData) => {
      const res = {
        ...customizeEstimate,
        ...(customizeEstimate.suggestedGasPrice ? { suggestedGasPrice: new Decimal(data.gasPrice).mul(1e9).toHex() } : null),
        ...(customizeEstimate.suggestedMaxFeePerGas ? { suggestedMaxFeePerGas: new Decimal(data.maxFeePerGas).mul(1e9).toHex() } : null),
        ...(customizeEstimate.suggestedMaxPriorityFeePerGas
          ? { suggestedMaxPriorityFeePerGas: new Decimal(data.maxPriorityFeePerGas).mul(1e9).toHex() }
          : null),
        gasLimit: new Decimal(data.gasLimit).toHex(),
        nonce: Number(data.nonce),
      };
      res.gasCost = new Decimal(res.suggestedMaxFeePerGas ?? res.suggestedGasPrice!).mul(res.gasLimit).toHex();
      onConfirm(res);
      bottomSheetRef.current?.close();
    },
    [customizeEstimate],
  );

  const handleInvalid = useCallback<SubmitErrorHandler<FormData>>((errors) => {
    const [errorData, errorContent] = Object.entries(errors)[0];
    showMessage({
      message: `Invalid ${errorData} value`,
      ...(errorContent.message ? { description: `${errorData} ${errorContent.message}` } : null),
      type: 'failed',
    });
  }, []);

  useEffect(() => {
    const unsubscribe = Keyboard.addListener('keyboardDidHide', () => {
      if (!showAdvance && bottomSheetIndexRef.current === 1) {
        bottomSheetRef.current?.snapToIndex(0);
      }
    });

    return () => unsubscribe.remove();
  }, [showAdvance]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={customizeEstimate.suggestedMaxFeePerGas ? snapPoints1559 : snapPoints155}
      style={styles.container}
      index={0}
      onChange={(index) => (bottomSheetIndexRef.current = index)}
      onClose={onClose}
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Customize Gas</Text>

      {customizeEstimate.suggestedGasPrice && (
        <>
          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>
            Gas price (Current: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{currentPriceGwei}</Text> Gwei)
          </Text>
          <Controller
            control={control}
            rules={controlRule}
            render={({ field: { onChange, onBlur, value } }) => <TextInput colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} />}
            name="gasPrice"
          />
          {isTooLow && (
            <View style={styles.tooLowTipWrapper}>
              <Warning color={colors.middle} />
              <Text style={[styles.tooLowTip, { color: colors.textPrimary }]}>
                Your offer is lower than the current base fee and may take a long time to wait.
              </Text>
            </View>
          )}
        </>
      )}

      {customizeEstimate.suggestedMaxFeePerGas && (
        <>
          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>
            Max base fee (Current: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{currentPriceGwei}</Text> Gwei)
          </Text>
          <Controller
            control={control}
            rules={controlRule}
            render={({ field: { onChange, onBlur, value } }) => <TextInput colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} />}
            name="maxFeePerGas"
          />
          {isTooLow && (
            <View style={styles.tooLowTipWrapper}>
              <Warning color={colors.middle} />
              <Text style={[styles.tooLowTip, { color: colors.textPrimary }]}>
                Your offer is lower than the current base fee and may take a long time to wait.
              </Text>
            </View>
          )}

          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>Priority fee</Text>
          <Controller
            control={control}
            rules={{ ...controlRule, validate: (value: string) => parseFloat(value) >= 0 || 'should be greater than or equal to 0' }}
            render={({ field: { onChange, onBlur, value } }) => <TextInput colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} />}
            name="maxPriorityFeePerGas"
          />
        </>
      )}

      <Pressable style={styles.advanceWrapper} onPress={handleTriggerAdvance}>
        <Text style={[styles.advance, { color: colors.textPrimary }]}>Advance</Text>
        <ArrowRight color={colors.iconPrimary} style={{ transform: [{ rotate: showAdvance ? '90deg' : '0deg' }] }} />
      </Pressable>

      {showAdvance && (
        <>
          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>Gas Limit</Text>
          <Controller
            control={control}
            rules={controlRule}
            render={({ field: { onChange, onBlur, value } }) => <TextInput colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} showGweiSuffix={false} />}
            name="gasLimit"
          />
          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>Nonce</Text>
          <Controller
            control={control}
            rules={controlRule}
            render={({ field: { onChange, onBlur, value } }) => <TextInput colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} showGweiSuffix={false} />}
            name="nonce"
          />
        </>
      )}

      <View style={[styles.btnArea, { marginTop: !showAdvance ? 16 : 24 }]}>
        <Button testID="cancel" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()}>
          {t('common.cancel')}
        </Button>
        <Button testID="confirm" style={styles.btn} size="small" onPress={handleSubmit(handleConfirm, handleInvalid)}>
          {t('common.confirm')}
        </Button>
      </View>
    </BottomSheet>
  );
};

const snapPoints1559 = [480, 660];
const snapPoints155 = [400, 580];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  inputTitle: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  textinput: {
    marginVertical: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  gwei: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  tooLowTipWrapper: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 64,
  },
  tooLowTip: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
  advanceWrapper: {
    marginTop: 8,
    marginBottom: 24,
    flexDirection: 'row',
    gap: 12,
  },
  advance: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

export default CustomizeSetting;
