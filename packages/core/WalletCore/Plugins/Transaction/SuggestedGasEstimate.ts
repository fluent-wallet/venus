import { fetchGasEstimatesViaEthFeeHistory as _fetchGasEstimatesViaEthFeeHistory } from '@metamask/gas-fee-controller';
import Decimal from 'decimal.js';

const Gwei = new Decimal(10).pow(9);

export const fetchGasEstimatesViaEthFeeHistory = async (query: any) =>
  _fetchGasEstimatesViaEthFeeHistory(query).then((res) => ({
    high: {
      suggestedMaxPriorityFeePerGas: new Decimal(res.high.suggestedMaxPriorityFeePerGas).mul(Gwei).toHex(),
      suggestedMaxFeePerGas: new Decimal(res.high.suggestedMaxFeePerGas).mul(Gwei).toHex(),
    },
    medium: {
      suggestedMaxPriorityFeePerGas: new Decimal(res.medium.suggestedMaxPriorityFeePerGas).mul(Gwei).toHex(),
      suggestedMaxFeePerGas: new Decimal(res.medium.suggestedMaxFeePerGas).mul(Gwei).toHex(),
    },
    low: {
      suggestedMaxPriorityFeePerGas: new Decimal(res.low.suggestedMaxPriorityFeePerGas).mul(Gwei).toHex(),
      suggestedMaxFeePerGas: new Decimal(res.low.suggestedMaxFeePerGas).mul(Gwei).toHex(),
    },
  }));

const levels = {
  high: {
    baseFeePercentageMultiplier: 1.2,
    priorityFeePercentageMultiplier: 1.2,
  },
  medium: {
    baseFeePercentageMultiplier: 1.1,
    priorityFeePercentageMultiplier: 1.1,
  },
  low: {
    baseFeePercentageMultiplier: 1,
    priorityFeePercentageMultiplier: 1,
  },
} as const;

export type Level = keyof typeof levels;

export const estimateFor1559FromGasPrice = (gasPrice: string) => {
  const price = new Decimal(gasPrice);

  return Object.fromEntries(
    Object.entries(levels).map(([level, value]) => [
      level,
      {
        suggestedMaxFeePerGas: price.mul(value.baseFeePercentageMultiplier).toHex(),
        suggestedMaxPriorityFeePerGas: price.mul(value.priorityFeePercentageMultiplier).toHex(),
      },
    ]),
  ) as Awaited<ReturnType<typeof fetchGasEstimatesViaEthFeeHistory>>;
};

export const calcGasCostFromEstimateOf1559 = (estimate: Awaited<ReturnType<typeof fetchGasEstimatesViaEthFeeHistory>>, gasLimit: string) => {
  return Object.fromEntries(
    Object.entries(estimate).map(([level, { suggestedMaxPriorityFeePerGas, suggestedMaxFeePerGas }]) => [
      level,
      {
        suggestedMaxFeePerGas: suggestedMaxPriorityFeePerGas,
        suggestedMaxPriorityFeePerGas: suggestedMaxFeePerGas,
        gasCost: new Decimal(suggestedMaxFeePerGas).mul(gasLimit).toHex(),
      },
    ]),
  ) as Record<Level, { suggestedMaxFeePerGas: string; suggestedMaxPriorityFeePerGas: string; gasCost: string }>;
};

export const estimateFromGasPrice = (gasPrice: string) => {
  const price = new Decimal(gasPrice);

  return Object.fromEntries(
    Object.entries(levels).map(([level, value]) => [
      level,
      {
        suggestedGasPrice: price.mul(value.baseFeePercentageMultiplier).toHex(),
      },
    ]),
  ) as Record<Level, { suggestedGasPrice: string }>;
};

export const calcGasCostFromEstimate = (estimate: ReturnType<typeof estimateFromGasPrice>, gasLimit: string) => {
  return Object.fromEntries(
    Object.entries(estimate).map(([level, { suggestedGasPrice }]) => [
      level,
      {
        suggestedGasPrice,
        gasCost: new Decimal(suggestedGasPrice).mul(gasLimit).toHex(),
      },
    ]),
  ) as Record<Level, { suggestedGasPrice: string; gasCost: string }>;
};
