import '@metamask/gas-fee-controller';
declare module '@metamask/gas-fee-controller' {
  export function fetchGasEstimatesViaEthFeeHistory(param: any): Promise<{
    estimatedBaseFee: string;
    high: { suggestedMaxPriorityFeePerGas: string; suggestedMaxFeePerGas: string };
    low: { suggestedMaxPriorityFeePerGas: string; suggestedMaxFeePerGas: string };
    medium: { suggestedMaxPriorityFeePerGas: string; suggestedMaxFeePerGas: string };
  }>;
}
