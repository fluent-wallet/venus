import { ASSET_TYPE } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import type { AssetInfo } from '@utils/assetInfo';
import { toAssetInfo } from '@utils/toAssetInfo';
import { escapeRegExp } from 'lodash-es';
import { useEffect, useMemo, useState } from 'react';
import { isValidAddress } from './address';
import { useAddCustomToken } from './asset';
import { getAssetService, type IAsset, type INetwork, type INftCollection } from './core';

export type AssetSearchItem =
  | { key: string; kind: 'token'; asset: AssetInfo }
  | { key: string; kind: 'nft-collection'; collection: INftCollection; index: number };

type SearchError = 'invalid-format' | 'invalid-ERC20' | 'network-error';
type SearchResult = {
  items: readonly AssetSearchItem[];
  status: 'idle' | 'searching' | 'ready' | SearchError;
};

type SearchState = SearchResult & { hasCompletedSearch: boolean };

type AssetSearchOptions = {
  text: string;
  assets: readonly IAsset[];
  nftCollections: readonly INftCollection[];
  includeNfts?: boolean;
  network: Pick<INetwork, 'id' | 'networkType'> | null | undefined;
  addressId: string;
  isLoadingLocalAssets: boolean;
};

const EMPTY_ITEMS: readonly AssetSearchItem[] = [];

function toTokenSearchItem(asset: IAsset): AssetSearchItem {
  return { key: `token:${asset.id}`, kind: 'token', asset: toAssetInfo(asset) };
}

function getLocalSearchItems(assets: readonly IAsset[], nftCollections: readonly INftCollection[], keyword: string): AssetSearchItem[] {
  if (!keyword) return [];
  const matcher = new RegExp(escapeRegExp(keyword), 'i');
  const matches = (fields: readonly (string | null | undefined)[]) => fields.some((field) => !!field && matcher.test(field));

  const tokens = assets
    .filter(
      (asset) =>
        (asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20) &&
        matches([asset.name, asset.symbol, asset.type === ASSET_TYPE.Native ? ASSET_TYPE.Native : asset.contractAddress]),
    )
    .map(toTokenSearchItem);
  const collections = nftCollections.filter((collection) => matches([collection.name, collection.symbol, collection.contractAddress]));

  return [...tokens, ...collections.map((collection, index): AssetSearchItem => ({ key: `nft:${collection.id}`, kind: 'nft-collection', collection, index }))];
}

export function useAssetSearch({
  text,
  assets,
  nftCollections,
  includeNfts = true,
  network,
  addressId,
  isLoadingLocalAssets,
}: AssetSearchOptions): SearchState {
  const keyword = text.trim();
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [remoteResult, setRemoteResult] = useState<(SearchResult & { requestKey: string }) | null>(null);
  const [completedResult, setCompletedResult] = useState<{ contextKey: string; items: readonly AssetSearchItem[] } | null>(null);
  const addCustomToken = useAddCustomToken();
  const assetService = getAssetService();
  const networkId = network?.id;
  const networkType = network?.networkType;
  const contextKey = JSON.stringify([addressId, networkId, includeNfts]);
  const requestKey = JSON.stringify([addressId, networkId, includeNfts, debouncedKeyword]);
  const isCurrentSearch = !!keyword && keyword === debouncedKeyword;
  const localItems = useMemo(
    () => getLocalSearchItems(assets, includeNfts ? nftCollections : [], debouncedKeyword),
    [assets, nftCollections, includeNfts, debouncedKeyword],
  );
  const hasLocalResults = localItems.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 200);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Asset refreshes recompute local matches; only changes to search eligibility restart a request.
  useEffect(() => {
    if (!isCurrentSearch || isLoadingLocalAssets || hasLocalResults || networkType === undefined || !addressId) return;

    let cancelled = false;
    const searchRemote = async () => {
      try {
        if (!isValidAddress({ networkType, addressValue: debouncedKeyword })) {
          setRemoteResult({ requestKey, status: 'invalid-format', items: EMPTY_ITEMS });
          return;
        }

        setRemoteResult({ requestKey, status: 'searching', items: EMPTY_ITEMS });
        if (!includeNfts && networkType === NetworkType.Ethereum) {
          // Receive requests cannot encode NFT transfers.
          const inspection = await assetService.inspectContractAsset({ addressId, contractAddress: debouncedKeyword });
          if (cancelled) return;
          if (inspection.assetType !== ASSET_TYPE.ERC20) {
            setRemoteResult({ requestKey, status: 'invalid-ERC20', items: EMPTY_ITEMS });
            return;
          }
        }
        const asset = await addCustomToken({ addressId, contractAddress: debouncedKeyword });
        if (!cancelled) {
          setRemoteResult({ requestKey, status: 'ready', items: [toTokenSearchItem(asset)] });
        }
      } catch (error) {
        if (!cancelled) {
          setRemoteResult({ requestKey, status: String(error).includes('timed out') ? 'network-error' : 'invalid-ERC20', items: EMPTY_ITEMS });
        }
      }
    };

    void searchRemote();
    return () => {
      cancelled = true;
    };
  }, [addressId, networkType, requestKey, debouncedKeyword, isCurrentSearch, hasLocalResults, isLoadingLocalAssets, addCustomToken, assetService, includeNfts]);

  const currentResult = useMemo<SearchResult>(() => {
    if (!isCurrentSearch) return { items: EMPTY_ITEMS, status: 'idle' };
    if (hasLocalResults) return { items: localItems, status: 'ready' };
    if (isLoadingLocalAssets) return { items: EMPTY_ITEMS, status: 'idle' };
    if (networkType === undefined || !addressId) return { items: EMPTY_ITEMS, status: 'network-error' };

    return remoteResult?.requestKey === requestKey ? remoteResult : { items: EMPTY_ITEMS, status: 'idle' };
  }, [isCurrentSearch, hasLocalResults, localItems, isLoadingLocalAssets, networkType, addressId, remoteResult, requestKey]);
  const isSearchComplete = currentResult.status !== 'idle' && currentResult.status !== 'searching';

  // Keep the last completed list visible while the next search is pending.
  useEffect(() => {
    if (!keyword) {
      setCompletedResult(null);
    } else if (isSearchComplete) {
      setCompletedResult({ contextKey, items: currentResult.items });
    }
  }, [keyword, isSearchComplete, contextKey, currentResult.items]);

  const previousResult = completedResult?.contextKey === contextKey ? completedResult : null;
  const displayedItems = isSearchComplete ? currentResult.items : (previousResult?.items ?? EMPTY_ITEMS);
  return {
    status: currentResult.status,
    items: keyword ? displayedItems : EMPTY_ITEMS,
    hasCompletedSearch: !!keyword && (isSearchComplete || previousResult !== null),
  };
}
