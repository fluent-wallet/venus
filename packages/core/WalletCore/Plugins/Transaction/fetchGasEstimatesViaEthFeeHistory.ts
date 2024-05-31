import { fetchGasEstimatesViaEthFeeHistory } from '@metamask/gas-fee-controller';
import Decimal from 'decimal.js';

const Gwei = new Decimal(10).pow(9);

const _fetchGasEstimatesViaEthFeeHistory = async (query: any) =>
  fetchGasEstimatesViaEthFeeHistory(query).then((res) => ({
    estimatedBaseFee: new Decimal(res.estimatedBaseFee).mul(Gwei).toHex(),
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

export default _fetchGasEstimatesViaEthFeeHistory;
