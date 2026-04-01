import type { IAsset } from '@service/core';
import { toBaseUnitsFromDecimalBalance } from '@utils/toBaseUnits';

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

export function toReceiveAssetFromIAsset(params: { asset: IAsset; networkId: string; addressId: string }): ReceiveAsset | null {
  if (typeof params.asset.decimals !== 'number') {
    return null;
  }

  const decimals = params.asset.decimals;
  const balanceBaseUnits = toBaseUnitsFromDecimalBalance(params.asset.balance, decimals);

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
