import { ASSET_SOURCE, ASSET_TYPE } from '@core/types';
import type { AssetInfo } from '@utils/assetInfo';
import Decimal from 'decimal.js';

interface TokenAssetLike {
  type: string;
  source: string | null;
  balance?: string | null;
}

export function shouldShowAssetOnHome(asset: { type: string; source: string | null; balance?: string | null }): boolean {
  if (asset.type === ASSET_TYPE.Native || asset.source === ASSET_SOURCE.Custom) {
    return true;
  }

  try {
    return new Decimal(asset.balance ?? '0').greaterThan(0);
  } catch {
    return false;
  }
}

export function hasPositiveTokenBalance(token: Pick<AssetInfo, 'balance'>): boolean {
  try {
    return BigInt(token.balance || '0') > 0n;
  } catch {
    return false;
  }
}

export function getTokenItemKey(token: Pick<AssetInfo, 'type' | 'contractAddress'>, index: number): string {
  if (token.type === ASSET_TYPE.Native) {
    return ASSET_TYPE.Native;
  }

  return token.contractAddress || String(index);
}

export function getVisibleTokenAssets<T extends TokenAssetLike>(assets: T[], { showHomeAssetsOnly }: { showHomeAssetsOnly: boolean }): T[] {
  return assets
    .filter((asset) => asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20)
    .filter((asset) => (showHomeAssetsOnly ? shouldShowAssetOnHome(asset) : true));
}

export function areDisplayTokensEmpty(tokens: Array<Pick<AssetInfo, 'balance'>>): boolean {
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => !hasPositiveTokenBalance(token));
}

export function shouldShowTokensSkeleton({
  addressId,
  assetsStatus,
  currentAddressStatus,
  tokenCount,
}: {
  addressId: string;
  assetsStatus: string;
  currentAddressStatus: string;
  tokenCount: number;
}): boolean {
  return tokenCount === 0 && (currentAddressStatus === 'pending' || (Boolean(addressId) && assetsStatus === 'pending'));
}
