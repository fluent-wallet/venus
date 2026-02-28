import type { AddCustomTokenInput } from '@core/services/asset/types';
import { ASSET_TYPE } from '@core/types';
import { type UseQueryResult, useQuery, useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { useCallback } from 'react';
import { useCurrentAddress } from './account';
import { getAssetService, type IAsset } from './core';

export type AssetsQuery = UseQueryResult<IAsset[]>;
export type AssetsSummary = { totalValue: string; hasTokens: boolean; hasNFTs: boolean };
export type AssetsSummaryQuery = UseQueryResult<AssetsSummary>;

const tokenTypes = new Set([ASSET_TYPE.Native, ASSET_TYPE.ERC20]);
const nftTypes = new Set([ASSET_TYPE.ERC721, ASSET_TYPE.ERC1155]);

export const getAssetRootKey = () => ['asset'] as const;
export const getAssetsByAddressKey = (addressId: string) => ['asset', 'byAddress', addressId] as const;

/**
 * Fetch assets of a specific address.
 * @example
 * const { data: assets } = useAssetsOfAddress(addressId);
 */
export function useAssetsOfAddress(addressId: string): AssetsQuery {
  const service = getAssetService();
  return useQuery({
    queryKey: getAssetsByAddressKey(addressId),
    queryFn: () => service.getAssetsByAddress(addressId),
    enabled: !!addressId,
  });
}

/**
 * Fetch assets of the current address.
 * @example
 * const { data: assets } = useAssetsOfCurrentAddress();
 */
export function useAssetsOfCurrentAddress(): AssetsQuery {
  const currentAddress = useCurrentAddress();
  const service = getAssetService();
  const addressId = currentAddress.data?.id ?? '';

  return useQuery({
    queryKey: getAssetsByAddressKey(addressId || 'none'),
    queryFn: () => (addressId ? service.getAssetsByAddress(addressId) : []),
    enabled: !!addressId,
    initialData: [],
  });
}

/**
 * Compute summary for an address.
 * @example
 * const { data: summary } = useAssetsSummaryOfAddress(addressId);
 */
export function useAssetsSummaryOfAddress(addressId: string): AssetsSummaryQuery {
  const service = getAssetService();
  return useQuery({
    queryKey: getAssetsByAddressKey(addressId),
    queryFn: () => service.getAssetsByAddress(addressId),
    enabled: !!addressId,
    select: (assets) => summarizeAssets(assets),
  });
}

/**
 * Compute summary for the current address.
 * @example
 * const { data: summary } = useAssetsSummaryOfCurrentAddress();
 */
export function useAssetsSummaryOfCurrentAddress(): AssetsSummaryQuery {
  const currentAddress = useCurrentAddress();
  const service = getAssetService();
  const addressId = currentAddress.data?.id ?? '';

  return useQuery({
    queryKey: getAssetsByAddressKey(addressId || 'none'),
    queryFn: () => (addressId ? service.getAssetsByAddress(addressId) : []),
    enabled: !!addressId,
    select: (assets) => summarizeAssets(assets),
    initialData: [],
  });
}

/**
 * Add a custom token and refresh asset caches.
 * @example
 * const addCustomToken = useAddCustomToken();
 * const asset = await addCustomToken({ addressId, contractAddress: '0x...' });
 */
export function useAddCustomToken() {
  const service = getAssetService();
  const queryClient = useQueryClient();
  return useCallback(
    async (input: AddCustomTokenInput) => {
      const asset = await service.addCustomToken(input);
      await queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
      await queryClient.invalidateQueries({ queryKey: getAssetsByAddressKey(input.addressId) });
      return asset;
    },
    [service, queryClient],
  );
}

function summarizeAssets(assets: IAsset[]): AssetsSummary {
  const total = assets.reduce((acc, asset) => acc.plus(asset.priceValue ?? 0), new Decimal(0));
  let hasTokens = false;
  let hasNFTs = false;

  for (const asset of assets) {
    const type = String(asset.type);
    if (tokenTypes.has(type)) hasTokens = true;
    if (nftTypes.has(type)) hasNFTs = true;
  }

  return { totalValue: total.toString(), hasTokens, hasNFTs };
}
