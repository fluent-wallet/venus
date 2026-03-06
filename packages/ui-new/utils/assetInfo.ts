import type { AssetTypeValue } from '@core/types';

export interface AssetInfo {
  type: AssetTypeValue | string;
  contractAddress?: string;
  name?: string;
  symbol: string;
  decimals: number;
  balance: string;
  icon?: string;
  priceInUSDT?: string;
  priceValue?: string;
}
