import { ASSET_TYPE } from '@core/types';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import type { IAsset } from '@service/core';
import Decimal from 'decimal.js';

export function toLegacyAssetInfo(asset: IAsset): AssetInfo {
  const decimals = typeof asset.decimals === 'number' ? asset.decimals : 18;
  const balance = asset.balance ? new Decimal(asset.balance) : new Decimal(0);
  const baseUnits = balance.mul(Decimal.pow(10, decimals)).toFixed(0);

  return {
    type: asset.type as unknown as AssetInfo['type'],
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

export function isLegacyTokenAsset(asset: AssetInfo): boolean {
  return asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20;
}
