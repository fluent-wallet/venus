import Failed from '@assets/icons/message-fail.svg';
import Warning from '@assets/icons/warn.svg';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import _TextInput from '@components/TextInput';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { Gwei, getMinGasPrice } from '@core/WalletCore/Plugins/Transaction/SuggestedGasEstimate';
import { useTheme } from '@react-navigation/native';
import Decimal from 'decimal.js';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type React from 'react';
import { type ComponentProps, memo, useCallback, useMemo, useRef } from 'react';
import { Controller, type SubmitErrorHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import type { GasSetting } from './index';

interface Props {
  customizeGasSetting: GasSetting;
  estimateCurrentGasPrice: string;
  defaultMaxPriorityFeePerGas?: string;
  onConfirm: (customizeGasSetting: GasSetting) => void;
  onClose: () => void;
  force155?: boolean;
}

const GweiSuffix = memo(() => {
  const { colors } = useTheme();
  return <Text style={[styles.gwei, { color: colors.textPrimary }]}>Gwei</Text>;
});

export const TextInput: React.FC<
  ComponentProps<typeof _TextInput> & { colors: ReturnType<typeof useTheme>['colors']; showGweiSuffix?: boolean; error?: boolean }
> = ({ colors, keyboardType = 'numeric', defaultHasValue = true, showVisible = false, isInBottomSheet = true, showGweiSuffix = true, error, ...props }) => (
  <_TextInput
    {...props}
    containerStyle={[styles.textinput, { borderColor: colors[error ? 'down' : 'borderFourth'] }]}
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
};

export const controlRule = {
  required: true,
  pattern: /^[0-9]*\.?[0-9]+$/,
  validate: (value: string) => Number.parseFloat(value) >= 0 || 'should be greater than 0',
};

const CustomizeGasSetting: React.FC<Props> = ({ customizeGasSetting, defaultMaxPriorityFeePerGas, estimateCurrentGasPrice, onClose, onConfirm, force155 }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const currentNetwork = useCurrentNetwork()!;
  const minGasPrice = useMemo(() => getMinGasPrice(currentNetwork), [currentNetwork?.id]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      ...(customizeGasSetting.suggestedGasPrice ? { gasPrice: new Decimal(customizeGasSetting.suggestedGasPrice ?? 0).div(Gwei).toString() } : null),
      ...(customizeGasSetting.suggestedMaxFeePerGas
        ? { maxFeePerGas: new Decimal(customizeGasSetting.suggestedMaxFeePerGas ?? 0).div(Gwei).toString() }
        : null),
      ...(customizeGasSetting.suggestedMaxPriorityFeePerGas
        ? { maxPriorityFeePerGas: new Decimal(defaultMaxPriorityFeePerGas ?? '0').div(Gwei).toString() }
        : null),
    },
  });

  const currentPriceGwei = useMemo(() => new Decimal(estimateCurrentGasPrice).div(Gwei).toString(), [estimateCurrentGasPrice]);
  const gasPriceInputVal = watch('gasPrice');
  const maxFeePerGasInputVal = watch('maxFeePerGas');
  const isPriceLowerThanCurrent = useMemo(
    () => Number.parseFloat(customizeGasSetting.suggestedMaxFeePerGas ? maxFeePerGasInputVal : gasPriceInputVal) < Number.parseFloat(currentPriceGwei),
    [maxFeePerGasInputVal, gasPriceInputVal, currentPriceGwei],
  );

  const handleConfirm = useCallback(
    (data: FormData) => {
      const res = {
        ...(customizeGasSetting.suggestedGasPrice ? { suggestedGasPrice: new Decimal(data.gasPrice).mul(Gwei).toHex() } : null),
        ...(customizeGasSetting.suggestedMaxFeePerGas ? { suggestedMaxFeePerGas: new Decimal(data.maxFeePerGas).mul(Gwei).toHex() } : null),
        ...(customizeGasSetting.suggestedMaxPriorityFeePerGas
          ? { suggestedMaxPriorityFeePerGas: new Decimal(data.maxPriorityFeePerGas).mul(Gwei).toHex() }
          : null),
      };
      onConfirm(res);
      bottomSheetRef.current?.close();
    },
    [customizeGasSetting],
  );

  const LessThanMinTip = useMemo(
    () => (
      <View style={styles.tooLowTipWrapper}>
        <Failed color={colors.down} />
        <Text style={[styles.tooLowTip, { color: colors.down }]}>
          {currentNetwork?.name} requires a minimum base fee of {new Decimal(minGasPrice).div(Gwei).toString()} Gwei
        </Text>
      </View>
    ),
    [colors, currentNetwork?.name, minGasPrice],
  );

  const LowerTip = useMemo(
    () => (
      <View style={styles.tooLowTipWrapper}>
        <Warning color={colors.middle} />
        <Text style={[styles.tooLowTip, { color: colors.textPrimary }]}>Your offer is lower than the current base fee and may take a long time to wait.</Text>
      </View>
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={customizeGasSetting.suggestedMaxFeePerGas ? (!force155 ? snapPoints1559 : snapPoints155) : snapPoints155}
      style={styles.container}
      index={0}
      onClose={onClose}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Customize Gas</Text>

      {customizeGasSetting.suggestedGasPrice && (
        <>
          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>
            Gas price (Current: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{currentPriceGwei}</Text> Gwei)
          </Text>
          <Controller
            control={control}
            rules={{
              ...controlRule,
              validate: (newGasPrice) => new Decimal(newGasPrice ?? '0').mul(Gwei).greaterThanOrEqualTo(new Decimal(minGasPrice)) || 'less-than-min',
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput error={!!errors?.gasPrice} colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} />
            )}
            name="gasPrice"
          />
          {errors?.gasPrice?.type === 'validate' && LessThanMinTip}
          {!errors?.gasPrice && isPriceLowerThanCurrent && LowerTip}
        </>
      )}

      {customizeGasSetting.suggestedMaxFeePerGas && (
        <>
          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>
            {!force155 ? 'Max base fee' : 'Gas price'} (Current: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{currentPriceGwei}</Text> Gwei)
          </Text>
          <Controller
            control={control}
            rules={{
              ...controlRule,
              validate: (newMaxFeePerGas) => new Decimal(newMaxFeePerGas ?? '0').mul(Gwei).greaterThanOrEqualTo(minGasPrice) || 'less-than-min',
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput error={!!errors?.maxFeePerGas} colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} />
            )}
            name="maxFeePerGas"
          />
          {errors?.maxFeePerGas?.type === 'validate' && LessThanMinTip}
          {!errors?.maxFeePerGas && isPriceLowerThanCurrent && LowerTip}

          {!force155 && (
            <>
              <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>Priority fee</Text>
              <Controller
                control={control}
                rules={controlRule}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput error={!!errors?.maxPriorityFeePerGas} colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} />
                )}
                name="maxPriorityFeePerGas"
              />
            </>
          )}
        </>
      )}

      <View style={styles.btnArea}>
        <Button testID="cancel" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()}>
          {t('common.cancel')}
        </Button>
        <Button testID="confirm" style={styles.btn} size="small" onPress={handleSubmit(handleConfirm)}>
          {t('common.confirm')}
        </Button>
      </View>
    </BottomSheet>
  );
};

const snapPoints1559 = [420];
const snapPoints155 = [368];

export const styles = StyleSheet.create({
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
  btnArea: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

export default CustomizeGasSetting;
