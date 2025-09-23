import Failed from '@assets/icons/message-fail.svg';
import Warning from '@assets/icons/warn.svg';
import {
  BottomSheetWrapper,
  BottomSheetHeader,
  BottomSheetContent,
  BottomSheetFooter,
  type BottomSheetMethods,
  InlineBottomSheet,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { minGasLimit } from '@core/WalletCore/Plugins/Transaction/SuggestedGasEstimate';
import { useTheme } from '@react-navigation/native';
import Decimal from 'decimal.js';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type React from 'react';
import { useCallback, useRef, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { TextInput, controlRule, styles } from './CustomizeGasSetting';
import type { AdvanceSetting } from './index';

interface Props {
  customizeAdvanceSetting: AdvanceSetting | null;
  estimateGasLimit: string;
  estimateNonce: number;
  onConfirm: (customizeAdvanceSetting: AdvanceSetting) => void;
  onClose: () => void;
  nonceDisabled?: boolean;
}

type FormData = {
  gasLimit: string;
  nonce: string;
  storageLimit: string;
};

const CustomizeAdvanceSetting: React.FC<Props> = ({ customizeAdvanceSetting, estimateGasLimit, estimateNonce, nonceDisabled, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const currentNetwork = useCurrentNetwork()!;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      gasLimit: new Decimal(customizeAdvanceSetting?.gasLimit ?? estimateGasLimit).toString(),
      nonce: String(customizeAdvanceSetting?.nonce ?? estimateNonce),
      storageLimit: new Decimal(customizeAdvanceSetting?.storageLimit ?? '0').toString(),
    },
    mode: 'onChange',
  });

  const handleConfirm = useCallback((data: FormData) => {
    onConfirm({
      gasLimit: new Decimal(data.gasLimit).toHex(),
      nonce: Number(data.nonce),
      storageLimit: new Decimal(data.storageLimit).toHex(),
    });
    bottomSheetRef.current?.close();
  }, []);

  const gasLimitInputVal = watch('gasLimit');
  const isGasLimitLowerThanEstimate = useMemo(() => Number(gasLimitInputVal ?? 0) < Number(estimateGasLimit ?? 0), [gasLimitInputVal, estimateGasLimit]);
  const LowerTip = useMemo(
    () => (
      <View style={styles.tooLowTipWrapper}>
        <Warning color={colors.middle} />
        <Text style={[styles.tooLowTip, { color: colors.textPrimary }]}>{t('tx.gasFee.advanceSetting.lowWarning')}</Text>
      </View>
    ),
    [colors, t],
  );

  const LessThanMinTip = useMemo(
    () => (
      <View style={styles.tooLowTipWrapper}>
        <Failed color={colors.down} />
        <Text style={[styles.tooLowTip, { color: colors.down }]}>
          {t('tx.gasFee.advanceSetting.miniumGasLimit', {
            network: currentNetwork?.name,
            gasLimit: minGasLimit.toString(),
          })}
        </Text>
      </View>
    ),
    [colors, currentNetwork?.name, t],
  );

  return (
    <InlineBottomSheet ref={bottomSheetRef} snapPoints={snapPoints} index={0} onClose={onClose}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('tx.gasFee.advanceSetting.title')} />
        <BottomSheetContent style={styles.contentStyle}>
          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>{t('tx.gasFee.advanceSetting.gasLimit')}</Text>
          <Controller
            control={control}
            rules={{
              required: true,
              validate: (newGasLimit) => new Decimal(newGasLimit || '0').greaterThanOrEqualTo(minGasLimit) || 'less-than-min',
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                error={!!errors.gasLimit}
                colors={colors}
                onBlur={onBlur}
                onChangeText={(v) => onChange((v || '').replace(/[^0-9]/g, ''))}
                value={value}
                showGweiSuffix={false}
              />
            )}
            name="gasLimit"
          />
          {errors.gasLimit?.type === 'validate' && LessThanMinTip}
          {!errors.gasLimit && isGasLimitLowerThanEstimate && LowerTip}

          <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>{t('tx.gasFee.advanceSetting.nonce')}</Text>
          <Controller
            control={control}
            rules={controlRule}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                error={!!errors.nonce}
                colors={colors}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                showGweiSuffix={false}
                disabled={nonceDisabled}
              />
            )}
            name="nonce"
          />
        </BottomSheetContent>
        <BottomSheetFooter>
          <View style={styles.btnArea}>
            <Button testID="cancel" style={styles.btn} size="small" onPress={() => bottomSheetRef.current?.close()}>
              {t('common.cancel')}
            </Button>
            <Button testID="confirm" style={styles.btn} size="small" disabled={!!errors.gasLimit} onPress={handleSubmit(handleConfirm)}>
              {t('common.confirm')}
            </Button>
          </View>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </InlineBottomSheet>
  );
};

const snapPoints = [448];

export default CustomizeAdvanceSetting;
