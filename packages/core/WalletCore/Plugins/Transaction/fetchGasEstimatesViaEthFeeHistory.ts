import { fetchGasEstimatesViaEthFeeHistory as _fetchGasEstimatesViaEthFeeHistory } from '@metamask/gas-fee-controller';
import Decimal from 'decimal.js';

const Gwei = new Decimal(10).pow(9);

export const fetchGasEstimatesViaEthFeeHistory = async (query: any) =>
  _fetchGasEstimatesViaEthFeeHistory(query).then((res) => ({
    // estimatedBaseFee: new Decimal(res.estimatedBaseFee).mul(Gwei).toHex(),
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
    baseFeePercentageMultiplier: 1.25,
    priorityFeePercentageMultiplier: 0.98,
  },
  medium: {
    baseFeePercentageMultiplier: 1.2,
    priorityFeePercentageMultiplier: 0.97,
  },
  low: {
    baseFeePercentageMultiplier: 1.1,
    priorityFeePercentageMultiplier: 0.94,
  },
} as const;

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
