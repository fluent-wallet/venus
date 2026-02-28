import type { Address, ASSET_TYPE } from '@core/types';

export type NftCollectionType = typeof ASSET_TYPE.ERC721 | typeof ASSET_TYPE.ERC1155;

/**
 * Plain NFT collection snapshot for UI.
 * `id` is the local Asset record id (per asset rule).
 */
export interface INftCollection {
  id: string;
  networkId: string;
  contractAddress: Address;
  type: NftCollectionType;
  name: string | null;
  symbol: string | null;
  icon: string | null;
}

/**
 * Plain NFT item snapshot for UI.
 */
export interface INftItem {
  tokenId: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  amount: string;
}
