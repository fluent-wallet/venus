import { AssetType } from './../../../database/models/Asset';
import { type Address } from './../../../database/models/Address';
import { type Network } from './../../../database/models/Network';

export type FetchAssetBalance = (params: {
  endpoint: string;
  accountAddress: Address;
  assets: Array<{
    contractAddress?: string | null;
    assetType?: Omit<AssetType, AssetType.ERC1155 | AssetType.ERC721>;
  }>;
  key?: string;
}) => Promise<Array<string>>;

type BaseAssetInfo = {
  type: AssetType;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  icon?: string;
  /** The conversion ratio of this token relative to usdt */
  priceInUSDT?: string;
  /** The value of this token denominated in usdt */
  priceValue?: string;
};

interface NativeAssetInfo extends BaseAssetInfo {
  type: AssetType.Native;
  contractAddress?: never | undefined;
}
interface ERCAssetInfo extends BaseAssetInfo {
  type: Exclude<AssetType, AssetType.Native>;
  contractAddress: string;
}

export type AssetInfo = NativeAssetInfo | ERCAssetInfo;

export interface Fetcher {
  fetchAssetsBalance?: FetchAssetBalance;
  fetchAssetsBalanceBatch?: FetchAssetBalance;
  fetchAssetsBalanceMulticall?: FetchAssetBalance;
  fetchFromServer?: (params: { address: Address; network: Network }) => Promise<Array<AssetInfo>>;
}
export const priorityFetcher = ['fetchAssetsBalanceMulticall', 'fetchAssetsBalanceBatch', 'fetchAssetsBalance'] as const;
