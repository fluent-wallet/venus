import type { AssetSource, AssetTypeValue } from '@core/types';

export interface IAsset {
  id: string;
  name: string | null;
  symbol: string | null;
  type: AssetTypeValue;
  contractAddress: string | null;
  decimals: number | null;
  icon: string | null;
  source: AssetSource | null;
  balance: string;
  formattedBalance: string;
  priceInUSDT: string | null;
  priceValue: string | null;
  networkId: string;
  assetRuleId: string;
}

export interface AddCustomTokenInput {
  addressId: string;
  contractAddress: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  icon?: string;
}

export type Erc20TokenInfo = {
  name: string | null;
  symbol: string | null;
  decimals: number;
  /**
   * ERC20 `balanceOf` result in base units (decimal string).
   */
  balance: string;
};
