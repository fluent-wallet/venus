import type { FeeFields, FeeSelection, TransactionQuotePresetOption } from '@core/services/transaction';
import type { Level } from '@service/transaction';

export interface LegacyGasSetting {
  suggestedGasPrice: string;
  suggestedMaxFeePerGas?: undefined;
  suggestedMaxPriorityFeePerGas?: undefined;
}

export interface Eip1559GasSetting {
  suggestedGasPrice?: undefined;
  suggestedMaxFeePerGas: string;
  suggestedMaxPriorityFeePerGas: string;
}

export type GasSetting = LegacyGasSetting | Eip1559GasSetting;

export type GasSettingLike = {
  suggestedGasPrice?: string;
  suggestedMaxFeePerGas?: string;
  suggestedMaxPriorityFeePerGas?: string;
};

export type GasSettingWithLevel = GasSetting & {
  level: 'customize' | Level;
};

export const isEip1559GasSetting = (setting: GasSettingLike | null | undefined): setting is Eip1559GasSetting => {
  return typeof setting?.suggestedMaxFeePerGas === 'string' && setting.suggestedMaxFeePerGas.length > 0;
};

export const getGasSettingPrimaryFee = (setting: GasSettingLike | null | undefined): string | undefined => {
  if (isEip1559GasSetting(setting)) {
    return setting.suggestedMaxFeePerGas;
  }
  return setting?.suggestedGasPrice;
};

export const buildGasSetting = (params: { pricingKind: 'legacy' | 'eip1559'; primaryFee: string; priorityFee?: string }): GasSetting => {
  if (params.pricingKind === 'eip1559') {
    return {
      suggestedMaxFeePerGas: params.primaryFee,
      suggestedMaxPriorityFeePerGas: params.priorityFee ?? params.primaryFee,
    };
  }

  return {
    suggestedGasPrice: params.primaryFee,
  };
};

export const toGasSetting = (fields: FeeFields): GasSetting => {
  if (typeof fields.gasPrice === 'string') {
    return {
      suggestedGasPrice: fields.gasPrice,
    };
  }

  return {
    suggestedMaxFeePerGas: fields.maxFeePerGas,
    suggestedMaxPriorityFeePerGas: fields.maxPriorityFeePerGas,
  };
};

export const toFeeFields = (setting: GasSetting): FeeFields => {
  if (typeof setting.suggestedGasPrice === 'string') {
    return {
      gasPrice: setting.suggestedGasPrice,
    };
  }

  return {
    maxFeePerGas: setting.suggestedMaxFeePerGas,
    maxPriorityFeePerGas: setting.suggestedMaxPriorityFeePerGas,
  };
};

export const resolveGasSettingWithLevel = (params: {
  fee: {
    selection: FeeSelection;
    fields: FeeFields;
  } | null;
  presetOptions: readonly TransactionQuotePresetOption[];
}): GasSettingWithLevel | null => {
  const { fee, presetOptions } = params;
  if (!fee) {
    return null;
  }

  const feeSelection = fee.selection;
  if (feeSelection.kind === 'custom') {
    return {
      ...toGasSetting(fee.fields),
      level: 'customize',
    };
  }

  const selectedPresetOption = presetOptions.find((option) => option.presetId === feeSelection.presetId) ?? null;
  if (!selectedPresetOption) {
    return null;
  }

  const isLegacyFee = typeof selectedPresetOption.fee.gasPrice === 'string';
  const primaryFee = isLegacyFee ? selectedPresetOption.fee.gasPrice : selectedPresetOption.fee.maxFeePerGas;
  const priorityFee = isLegacyFee ? undefined : selectedPresetOption.fee.maxPriorityFeePerGas;
  if (!primaryFee) {
    return null;
  }

  return buildGasSettingWithLevel({
    pricingKind: isLegacyFee ? 'legacy' : 'eip1559',
    level: selectedPresetOption.presetId,
    primaryFee,
    priorityFee,
  });
};

export const buildGasSettingWithLevel = (params: {
  pricingKind: 'legacy' | 'eip1559';
  level: 'customize' | Level;
  primaryFee: string;
  priorityFee?: string;
}): GasSettingWithLevel => {
  return {
    ...buildGasSetting(params),
    level: params.level,
  };
};
