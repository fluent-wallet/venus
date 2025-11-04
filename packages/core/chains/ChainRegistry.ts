import type { ChainType, IChainProvider, IChainRegistry } from '@core/types';

type RegistryKey = `${ChainType}:${string}`;

function toRegistryKey(networkType: ChainType, chainId: string): RegistryKey {
  return `${networkType}:${chainId.toLowerCase()}`;
}

export class ChainRegistry implements IChainRegistry {
  private readonly providers = new Map<RegistryKey, IChainProvider>();

  get size(): number {
    return this.providers.size;
  }

  register(provider: IChainProvider): this {
    const key = toRegistryKey(provider.networkType, provider.chainId);
    if (this.providers.has(key)) {
      throw new Error(`Chain already registered: ${provider.networkType} (${provider.chainId})`);
    }
    this.providers.set(key, provider);
    return this;
  }

  get(chainId: string, networkType?: ChainType): IChainProvider | undefined {
    if (networkType) {
      return this.providers.get(toRegistryKey(networkType, chainId));
    }

    const matches = [...this.providers.values()].filter(({ chainId: id }) => id.toLowerCase() === chainId.toLowerCase());
    if (matches.length > 1) {
      throw new Error(`Multiple providers found for chainId ${chainId}; please specify networkType`);
    }
    return matches[0];
  }

  getByType(chainType: ChainType): IChainProvider[] {
    return [...this.providers.values()].filter((provider) => provider.networkType === chainType);
  }

  has(chainId: string, networkType?: ChainType): boolean {
    if (networkType) {
      return this.providers.has(toRegistryKey(networkType, chainId));
    }
    return [...this.providers.values()].some(({ chainId: id }) => id.toLowerCase() === chainId.toLowerCase());
  }

  getAll(): IChainProvider[] {
    return [...this.providers.values()];
  }
}
