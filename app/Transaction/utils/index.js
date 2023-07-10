import BN from 'bn.js';
import {formatUnits} from '@ethersproject/units';
import {ETH_TX_TYPES} from '../../Consts/network';

//Gas station url for EIP1559
export const GAS_API_BASE_URL = 'https://gas-api.metaswap.codefi.network';
// How many blocks to consider for priority fee estimation
export const FEE_HISTORY_BLOCKS = 5;
// Levels of priority fee
export const PRIORITY_LEVELS = ['low', 'medium', 'high'];
export const SETTINGS_BY_PRIORITY_LEVEL = {
  low: {
    percentile: 10,
    baseFeePercentageMultiplier: new BN(110),
    minSuggestedMaxPriorityFeePerGas: new BN(1000000000),
  },
  medium: {
    percentile: 20,
    baseFeePercentageMultiplier: new BN(120),
    minSuggestedMaxPriorityFeePerGas: new BN(1500000000),
  },
  high: {
    percentile: 30,
    baseFeePercentageMultiplier: new BN(125),
    minSuggestedMaxPriorityFeePerGas: new BN(2000000000),
  },
};
// Which percentile of effective priority fees to include
export const FEE_HISTORY_PERCENTILES = [
  SETTINGS_BY_PRIORITY_LEVEL.low.percentile,
  SETTINGS_BY_PRIORITY_LEVEL.medium.percentile,
  SETTINGS_BY_PRIORITY_LEVEL.high.percentile,
];

export function calculateGasFeeEstimatesForPriorityLevels(
  feeData,
  baseFeePerGas,
) {
  const levelSpecificEstimates = PRIORITY_LEVELS.reduce(
    (obj, priorityLevel) => {
      const gasEstimatesForPriorityLevel = calculateEstimatesForPriorityLevel(
        priorityLevel,
        feeData,
        baseFeePerGas,
      );
      return {...obj, [priorityLevel]: gasEstimatesForPriorityLevel};
    },
    {},
  );
  return {
    ...levelSpecificEstimates,
    estimatedBaseFee: formatUnits(baseFeePerGas.toString(), 'gwei'),
  };
}

export function calculateEstimatesForPriorityLevel(
  priorityLevel,
  feeData,
  baseFeePerGas,
) {
  const settings = SETTINGS_BY_PRIORITY_LEVEL[priorityLevel];
  const adjustedBaseFeePerGas = baseFeePerGas
    .mul(settings.baseFeePercentageMultiplier)
    .divn(100);
  const priorityFees = feeData.reward
    ?.map(
      rewards =>
        new BN(Number(rewards[PRIORITY_LEVELS.indexOf(priorityLevel)])),
    )
    .filter(BN.isBN);
  const adjustedPriorityFee = medianOf(priorityFees);
  const suggestedMaxPriorityFeePerGas = BN.max(
    adjustedPriorityFee,
    settings.minSuggestedMaxPriorityFeePerGas,
  );
  const suggestedMaxFeePerGas = adjustedBaseFeePerGas.add(
    suggestedMaxPriorityFeePerGas,
  );
  return {
    suggestedMaxPriorityFeePerGas: formatUnits(
      suggestedMaxPriorityFeePerGas.toString(),
      'gwei',
    ),
    suggestedMaxFeePerGas: formatUnits(
      suggestedMaxFeePerGas.toString(),
      'gwei',
    ),
  };
}

function medianOf(numbers) {
  const sortedNumbers = numbers.slice().sort((a, b) => a.cmp(b));
  const len = sortedNumbers.length;
  const index = Math.floor((len - 1) / 2);
  return sortedNumbers[index];
}

export async function getGasFeeByGasStation(chainId) {
  const gasFeeApiUrl = `${GAS_API_BASE_URL}/networks/${chainId}/suggestedGasFees`;
  const res = await fetch(gasFeeApiUrl, {
    method: 'GET',
    headers: {'Content-Type': 'application/json'},
  });
  if (!res.ok) {
    throw new Error(
      `Fetch failed with status '${res.status}' for request gasFeeApi`,
    );
  }
  return res.json();
}
export function toEthersTx(tx) {
  const {from, type, gas, chainId, ...ethersTx} = tx;
  ethersTx.chainId = parseInt(chainId, 16);
  ethersTx.gasLimit = gas;
  ethersTx.type = parseInt(type, 16);
  if (type === ETH_TX_TYPES.EIP1559) {
    //EIP-1559
    delete ethersTx.gasPrice;
  }
  return ethersTx;
}
