import type { IChainProvider } from '@core/types';
import type { AssetTypeValue } from '@core/types/asset';
import type { NetworkType } from '@core/utils/consts';

export type AssetDiscoveryInput = {
  address: {
    value: string;
    hex: string;
  };
  network: {
    chainId: string;
    networkType: NetworkType;
  };
  chainProvider: IChainProvider;
};

export type DiscoveredFungibleAsset = {
  type: AssetTypeValue;
  contractAddress: string | null;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  icon: string | null;
  priceInUSDT: string | null;
  balanceBaseUnits: string;
};

export interface IAssetDiscoveryProvider {
  supports(input: { chainId: string; networkType: NetworkType }): boolean;
  discoverFungibleAssets(input: AssetDiscoveryInput): Promise<DiscoveredFungibleAsset[] | null>;
}
