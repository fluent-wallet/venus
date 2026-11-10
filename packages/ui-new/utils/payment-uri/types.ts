import type { NetworkType } from '@core/utils/consts';

export type PaymentAsset = { type: 'native' } | { type: 'erc20'; contractAddress: string };

export type PaymentRequest = {
  networkType: NetworkType;
  chainId?: bigint;
  recipientAddress: string;
  asset: PaymentAsset;
  amountBaseUnits?: bigint;
};
