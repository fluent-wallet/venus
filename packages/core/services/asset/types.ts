import type { AssetSource, AssetType } from '@core/database/models/Asset';

export interface IAsset {
  id: string;
  name: string | null;
  symbol: string | null;
  type: AssetType;
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
