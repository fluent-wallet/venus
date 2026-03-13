import type { AnyChainProvider, ChainType, IChainRegistry } from '@core/types';
import { injectable } from 'inversify';

type RegistryKey = `${ChainType}:${string}`;

function toRegistryKey(networkType: ChainType, chainId: string): RegistryKey {
  return `${networkType}:${chainId.toLowerCase()}`;
}

@injectable()
export class ChainRegistry implements IChainRegistry {
  private readonly providers = new Map<RegistryKey, AnyChainProvider>();

  get size(): number {
    return this.providers.size;
  }

  register(provider: AnyChainProvider): this {
    const key = toRegistryKey(provider.networkType, provider.chainId);
    if (this.providers.has(key)) {
      throw new Error(`Chain already registered: ${provider.networkType} (${provider.chainId})`);
    }
    this.providers.set(key, provider);
    return this;
  }

  get<TProvider extends AnyChainProvider = AnyChainProvider>(chainId: string, networkType?: ChainType): TProvider | undefined {
    if (networkType) {
      return this.providers.get(toRegistryKey(networkType, chainId)) as TProvider | undefined;
    }

    const matches = [...this.providers.values()].filter(({ chainId: id }) => id.toLowerCase() === chainId.toLowerCase());
    if (matches.length > 1) {
      throw new Error(`Multiple providers found for chainId ${chainId}; please specify networkType`);
    }
    return matches[0] as TProvider | undefined;
  }

  getByType<TProvider extends AnyChainProvider = AnyChainProvider>(chainType: ChainType): TProvider[] {
    return [...this.providers.values()].filter((provider) => provider.networkType === chainType) as TProvider[];
  }

  has(chainId: string, networkType?: ChainType): boolean {
    if (networkType) {
      return this.providers.has(toRegistryKey(networkType, chainId));
    }
    return [...this.providers.values()].some(({ chainId: id }) => id.toLowerCase() === chainId.toLowerCase());
  }

  getAll(): AnyChainProvider[] {
    return [...this.providers.values()];
  }
}
