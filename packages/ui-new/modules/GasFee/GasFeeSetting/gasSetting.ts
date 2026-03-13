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
