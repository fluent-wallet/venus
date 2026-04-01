import { ASSET_TYPE } from '@core/types';
import type { IAsset } from '@service/core';
import type { AssetInfo } from '@utils/assetInfo';
import { toBaseUnitsFromDecimalBalance } from './toBaseUnits';

export function toAssetInfo(asset: IAsset): AssetInfo | null {
  if (typeof asset.decimals !== 'number') {
    return null;
  }

  const decimals = asset.decimals;
  const baseUnits = toBaseUnitsFromDecimalBalance(asset.balance, decimals);

  return {
    type: asset.type,
    contractAddress: asset.contractAddress ?? '',
    name: asset.name ?? '',
    symbol: asset.symbol ?? '',
    decimals,
    balance: baseUnits,
    icon: asset.icon ?? undefined,
    priceInUSDT: asset.priceInUSDT ?? undefined,
    priceValue: asset.priceValue ?? undefined,
  };
}

export function isTokenAssetInfo(asset: AssetInfo): boolean {
  return asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20;
}
