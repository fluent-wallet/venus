import Failed from '@assets/icons/message-fail.svg';
import Warning from '@assets/icons/warn.svg';
import Button from '@components/Button';
import Sheet, { SheetBody, SheetFooter, SheetHeader } from '@components/Sheet';
import Text from '@components/Text';
import _TextInput from '@components/TextInput';
import { useTheme } from '@react-navigation/native';
import { getTransactionService } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import Decimal from 'decimal.js';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type React from 'react';
import { type ComponentProps, memo, useCallback, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { buildGasSetting, type GasSetting, isEip1559GasSetting } from './gasSetting';

interface Props {
  isOpen: boolean;
  customizeGasSetting: GasSetting;
  estimateCurrentGasPrice: string;
  onConfirm: (customizeGasSetting: GasSetting) => void;
  onClose: () => void;
  force155?: boolean;
}

const Gwei = new Decimal(10).pow(9);

const GweiSuffix = memo(() => {
  const { colors } = useTheme();
  return <Text style={[styles.gwei, { color: colors.textPrimary }]}>Gwei</Text>;
});

export const TextInput: React.FC<
  ComponentProps<typeof _TextInput> & {
    colors: ReturnType<typeof useTheme>['colors'];
    showGweiSuffix?: boolean;
    error?: boolean;
  }
> = ({ colors, keyboardType = 'numeric', defaultHasValue = true, showVisible = false, showGweiSuffix = true, error, disabled, ...props }) => (
  <_TextInput
    {...props}
    containerStyle={[
      styles.textinput,
      { borderColor: colors[error ? 'down' : 'borderFourth'] },
      disabled && { backgroundColor: colors.bgPrimary, borderColor: colors.borderFourth },
    ]}
    style={disabled && { color: colors.textSecondary }}
    keyboardType={keyboardType}
    defaultHasValue={defaultHasValue}
    showVisible={showVisible}
    SuffixIcon={showGweiSuffix ? <GweiSuffix /> : undefined}
    disabled={disabled}
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

const CustomizeGasSetting: React.FC<Props> = ({ isOpen, ...props }) => {
  const { colors } = useTheme();
  const height = isEip1559GasSetting(props.customizeGasSetting) && !props.force155 ? 500 : 368;

  return (
    <Sheet isPresented={isOpen} height={{ height }} containerColor={colors.bgFourth} onDismiss={props.onClose}>
      <CustomizeGasSettingContent {...props} />
    </Sheet>
  );
};

const CustomizeGasSettingContent: React.FC<Omit<Props, 'isOpen'>> = ({ customizeGasSetting, estimateCurrentGasPrice, onClose, onConfirm, force155 }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: currentNetwork } = useCurrentNetwork();
  const minGasPrice = useMemo(
    () => (currentNetwork ? getTransactionService().getMinGasPriceWei({ chainId: currentNetwork.chainId, networkType: currentNetwork.networkType }) : null),
    [currentNetwork],
  );

  const validateMinGasPrice = (gasPriceGwei: string): boolean | 'less-than-min' => {
    if (minGasPrice === null) return false;

    const gasPriceWei = new Decimal(gasPriceGwei || '0').mul(Gwei);
    return gasPriceWei.greaterThanOrEqualTo(minGasPrice) ? true : 'less-than-min';
  };

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      ...(!isEip1559GasSetting(customizeGasSetting)
        ? {
            gasPrice: new Decimal(customizeGasSetting.suggestedGasPrice).div(Gwei).toString(),
          }
        : null),
      ...(isEip1559GasSetting(customizeGasSetting)
        ? {
            maxFeePerGas: new Decimal(customizeGasSetting.suggestedMaxFeePerGas).div(Gwei).toString(),
          }
        : null),
      ...(isEip1559GasSetting(customizeGasSetting)
        ? {
            maxPriorityFeePerGas: new Decimal(customizeGasSetting.suggestedMaxPriorityFeePerGas).div(Gwei).toString(),
          }
        : null),
    },
  });

  const currentPriceGwei = useMemo(() => new Decimal(estimateCurrentGasPrice).div(Gwei).toString(), [estimateCurrentGasPrice]);
  const gasPriceInputVal = watch('gasPrice');
  const maxFeePerGasInputVal = watch('maxFeePerGas');
  const isPriceLowerThanCurrent = useMemo(
    () => Number.parseFloat(isEip1559GasSetting(customizeGasSetting) ? maxFeePerGasInputVal : gasPriceInputVal) < Number.parseFloat(currentPriceGwei),
    [maxFeePerGasInputVal, gasPriceInputVal, currentPriceGwei, customizeGasSetting],
  );

  const handleConfirm = useCallback(
    (data: FormData) => {
      const res = isEip1559GasSetting(customizeGasSetting)
        ? buildGasSetting({
            pricingKind: 'eip1559',
            primaryFee: new Decimal(data.maxFeePerGas).mul(Gwei).toHex(),
            priorityFee: new Decimal(data.maxPriorityFeePerGas).mul(Gwei).toHex(),
          })
        : buildGasSetting({
            pricingKind: 'legacy',
            primaryFee: new Decimal(data.gasPrice).mul(Gwei).toHex(),
          });
      onConfirm(res);
      onClose();
    },
    [customizeGasSetting, onConfirm, onClose],
  );

  const LessThanMinTip = useMemo(() => {
    if (minGasPrice === null) return null;

    return (
      <View style={styles.tooLowTipWrapper}>
        <Failed color={colors.down} />
        <Text style={[styles.tooLowTip, { color: colors.down }]}>
          {t('tx.gasFee.customizeGasSetting.minimumGasPrice', {
            network: currentNetwork?.name,
            gasPriceType: !isEip1559GasSetting(customizeGasSetting) || force155 ? 'gas price' : 'base fee',
            gasPrice: new Decimal(minGasPrice).div(Gwei).toString(),
          })}
        </Text>
      </View>
    );
  }, [colors, currentNetwork?.name, minGasPrice, customizeGasSetting, force155, t]);

  const GreatThanMaxFeeTip = useMemo(
    () => (
      <View style={styles.tooLowTipWrapper}>
        <Failed color={colors.down} />
        <Text style={[styles.tooLowTip, { color: colors.down }]}>{t('tx.gasFee.customizeGasSetting.greatThenMaxFeeError')}</Text>
      </View>
    ),
    [colors, t],
  );

  const LowerTip = useMemo(
    () => (
      <View style={styles.tooLowTipWrapper}>
        <Warning color={colors.middle} />
        <Text style={[styles.tooLowTip, { color: colors.textPrimary }]}>{t('tx.gasFee.customizeGasSetting.lowWarning')}</Text>
      </View>
    ),
    [colors, t],
  );

  return (
    <>
      <SheetHeader title={t('tx.gasFee.customizeGasSetting.title')} />
      <SheetBody style={styles.contentStyle}>
        {!isEip1559GasSetting(customizeGasSetting) && (
          <>
            <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>
              {t('tx.gasFee.customizeGasSetting.gasPrice')} ({t('tx.gasFee.customizeGasSetting.current')}:{' '}
              <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{currentPriceGwei}</Text> Gwei)
            </Text>
            <Controller
              control={control}
              rules={{
                ...controlRule,
                validate: validateMinGasPrice,
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

        {isEip1559GasSetting(customizeGasSetting) && (
          <>
            <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>
              {!force155 ? t('tx.gasFee.customizeGasSetting.maxFee') : t('tx.gasFee.customizeGasSetting.gasPrice')} (
              {t('tx.gasFee.customizeGasSetting.current')}: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{currentPriceGwei}</Text> Gwei)
            </Text>
            <Controller
              control={control}
              rules={{
                ...controlRule,
                validate: validateMinGasPrice,
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
                <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>{t('tx.gasFee.customizeGasSetting.priorityFee')}</Text>
                <Controller
                  control={control}
                  rules={{
                    ...controlRule,
                    validate: (newMaxPriorityFeePerGas, value) =>
                      new Decimal(newMaxPriorityFeePerGas || '0').lessThanOrEqualTo(value.maxFeePerGas || '0') || 'great-than-max-fee',
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput error={!!errors?.maxPriorityFeePerGas} colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} />
                  )}
                  name="maxPriorityFeePerGas"
                />
                {errors?.maxPriorityFeePerGas?.type === 'validate' && GreatThanMaxFeeTip}
              </>
            )}
          </>
        )}
      </SheetBody>
      <SheetFooter>
        <View style={styles.btnArea}>
          <Button testID="cancel" style={styles.btn} size="small" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button testID="confirm" style={styles.btn} size="small" disabled={minGasPrice === null} onPress={() => handleSubmit(handleConfirm)()}>
            {t('common.confirm')}
          </Button>
        </View>
      </SheetFooter>
    </>
  );
};

export const styles = StyleSheet.create({
  contentStyle: {
    paddingTop: 14,
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
  },
  btn: {
    width: '50%',
    flexShrink: 1,
  },
});

export default CustomizeGasSetting;
