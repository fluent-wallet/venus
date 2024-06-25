/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import Decimal from 'decimal.js';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { minGasLimit } from '@core/WalletCore/Plugins/Transaction/SuggestedGasEstimate';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import Button from '@components/Button';
import Warning from '@assets/icons/message-warning.svg';
import Failed from '@assets/icons/message-fail.svg';
import { TextInput, controlRule, styles } from './CustomizeGasSetting';
import { type AdvanceSetting } from './index';

interface Props {
  customizeAdvanceSetting: AdvanceSetting | null;
  estimateGasLimit: string;
  estimateNonce: number;
  onConfirm: (customizeAdvanceSetting: AdvanceSetting) => void;
  onClose: () => void;
}

type FormData = {
  gasLimit: string;
  nonce: string;
  storageLimit: string;
};

const CustomizeAdvanceSetting: React.FC<Props> = ({ customizeAdvanceSetting, estimateGasLimit, estimateNonce, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const currentNetwork = useCurrentNetwork()!;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      gasLimit: new Decimal(customizeAdvanceSetting?.gasLimit ?? estimateGasLimit).toString(),
      nonce: String(customizeAdvanceSetting?.nonce ?? estimateNonce),
      storageLimit: new Decimal(customizeAdvanceSetting?.storageLimit ?? '0').toString(),
    },
  });

  const handleConfirm = useCallback((data: FormData) => {
    onConfirm({ gasLimit: new Decimal(data.gasLimit).toHex(), nonce: Number(data.nonce), storageLimit: new Decimal(data.storageLimit).toHex() });
    bottomSheetRef.current?.close();
  }, []);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} style={styles.container} index={0} onClose={onClose}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Advance Setting</Text>
      <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>Gas Limit</Text>
      <Controller
        control={control}
        rules={{ required: true, validate: (newGasLimit) => new Decimal(newGasLimit ?? '0').greaterThanOrEqualTo(minGasLimit) || 'less-than-min' }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput error={!!errors.gasLimit} colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} showGweiSuffix={false} />
        )}
        name="gasLimit"
      />
      {errors.gasLimit?.type === 'validate' && (
        <View style={styles.tooLowTipWrapper}>
          <Failed color={colors.down} />
          <Text style={[styles.tooLowTip, { color: colors.down }]}>
            {currentNetwork?.name} requires a minimum gasLimit of {minGasLimit.toString()}.
          </Text>
        </View>
      )}

      <Text style={[styles.inputTitle, { color: colors.textSecondary }]}>Nonce</Text>
      <Controller
        control={control}
        rules={controlRule}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput error={!!errors.nonce} colors={colors} onBlur={onBlur} onChangeText={onChange} value={value} showGweiSuffix={false} />
        )}
        name="nonce"
      />

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

const snapPoints = [420];

export default CustomizeAdvanceSetting;
