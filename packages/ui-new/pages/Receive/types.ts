import type { IAsset } from '@service/core';
import Decimal from 'decimal.js';

export type ReceiveAsset = {
  type: string;
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  icon?: string;
  priceInUSDT?: string;
  priceValue?: string;
  balanceBaseUnits: string;
  networkId: string;
  addressId: string;
};

export function toReceiveAssetFromIAsset(params: { asset: IAsset; networkId: string; addressId: string }): ReceiveAsset {
  const decimals = typeof params.asset.decimals === 'number' ? params.asset.decimals : 18;
  const balanceDecimal = params.asset.balance ? new Decimal(params.asset.balance) : new Decimal(0);
  const balanceBaseUnits = balanceDecimal.mul(Decimal.pow(10, decimals)).toFixed(0);

  return {
    type: String(params.asset.type),
    contractAddress: params.asset.contractAddress ?? '',
    name: params.asset.name ?? params.asset.symbol ?? '',
    symbol: params.asset.symbol ?? '',
    decimals,
    icon: params.asset.icon ?? undefined,
    priceInUSDT: params.asset.priceInUSDT ?? undefined,
    priceValue: params.asset.priceValue ?? undefined,
    balanceBaseUnits,
    networkId: params.networkId,
    addressId: params.addressId,
  };
}
