import type { NetworkType } from '@core/utils/consts';
import { injectable } from 'inversify';
import type { AssetDiscoveryInput, DiscoveredFungibleAsset, IAssetDiscoveryProvider } from './types';

@injectable()
export class AssetDiscoveryRegistry {
  private readonly providers: readonly IAssetDiscoveryProvider[];

  constructor(providers: IAssetDiscoveryProvider[] = []) {
    this.providers = providers.slice();
  }

  getProvider(input: { chainId: string; networkType: NetworkType }): IAssetDiscoveryProvider | null {
    return this.providers.find((provider) => provider.supports(input)) ?? null;
  }

  async discoverFungibleAssets(input: AssetDiscoveryInput): Promise<DiscoveredFungibleAsset[] | null> {
    const provider = this.getProvider(input.network);
    if (!provider) {
      return null;
    }
    return provider.discoverFungibleAssets(input);
  }
}
