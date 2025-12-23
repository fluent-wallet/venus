import { ChainRegistry } from '@core/chains';
import { CHAIN_PROVIDER_NOT_FOUND, CHAIN_RPC_INVALID_RESPONSE, CoreError } from '@core/errors';
import type { ChainRpcRequestOptions, ChainType, IChainProvider } from '@core/types';
import { NetworkType } from '@core/types';
import { inject, injectable } from 'inversify';

type ChainRef = {
  chainId: string;
  networkType: ChainType;
};

type CacheEntry = { value: bigint; expiresAtMs: number };
type GetEpochHeightOptions = ChainRpcRequestOptions & { epochTag?: string };
const DEFAULT_TTL_MS = 1000;

@injectable()
export class ChainStatusService {
  @inject(ChainRegistry)
  private readonly chainRegistry!: ChainRegistry;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<bigint>>();
  private readonly ttlMs = DEFAULT_TTL_MS;

  async getBlockNumber(chain: ChainRef, options?: ChainRpcRequestOptions): Promise<bigint> {
    if (chain.networkType !== NetworkType.Ethereum) {
      throw new Error('ChainStatusService.getBlockNumber is only supported for Ethereum networks.');
    }

    const provider = this.getChainProvider(chain);
    const cacheKey = this.getCacheKey(chain, 'evm:blockNumber');

    return this.queryWithCache(cacheKey, async () => {
      const raw = await provider.rpc.request('eth_blockNumber', undefined, options);
      return this.toBigInt(raw, 'eth_blockNumber');
    });
  }

  async getEpochHeight(chain: ChainRef, options?: GetEpochHeightOptions): Promise<bigint> {
    if (chain.networkType !== NetworkType.Conflux) {
      throw new Error('ChainStatusService.getEpochHeight is only supported for Conflux networks.');
    }

    const provider = this.getChainProvider(chain);

    const epochTag = options?.epochTag ?? 'latest_state';
    const rpcOptions: ChainRpcRequestOptions | undefined =
      options?.signal || options?.timeoutMs ? { signal: options?.signal, timeoutMs: options?.timeoutMs } : undefined;

    const cacheKey = this.getCacheKey(chain, `cfx:epochHeight:${epochTag}`);

    return this.queryWithCache(cacheKey, async () => {
      const raw = await provider.rpc.request('cfx_epochNumber', [epochTag], rpcOptions);
      return this.toBigInt(raw, 'cfx_epochNumber');
    });
  }

  private getChainProvider(chain: ChainRef): IChainProvider {
    const provider = this.chainRegistry.get(chain.chainId, chain.networkType);
    if (!provider) {
      throw new CoreError({
        code: CHAIN_PROVIDER_NOT_FOUND,
        message: 'Chain provider not found.',
        context: { chainId: chain.chainId, networkType: chain.networkType },
      });
    }
    return provider;
  }

  private getCacheKey(chain: ChainRef, kind: string): string {
    return `${String(chain.networkType)}:${chain.chainId.toLowerCase()}:${kind}`;
  }

  private async queryWithCache(cacheKey: string, query: () => Promise<bigint>): Promise<bigint> {
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAtMs > now) return cached.value;

    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await query();
        this.cache.set(cacheKey, { value, expiresAtMs: Date.now() + this.ttlMs });
        return value;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  private toBigInt(value: unknown, method: string): bigint {
    if (typeof value === 'bigint') return value;

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new CoreError({
          code: CHAIN_RPC_INVALID_RESPONSE,
          message: 'Invalid JSON-RPC result type.',
          context: { method, resultType: 'number', value },
        });
      }
      return BigInt(value);
    }

    if (typeof value === 'string') {
      try {
        return BigInt(value);
      } catch (error) {
        throw new CoreError({
          code: CHAIN_RPC_INVALID_RESPONSE,
          message: 'Invalid JSON-RPC result type.',
          cause: error,
          context: { method, resultType: 'string' },
        });
      }
    }

    throw new CoreError({
      code: CHAIN_RPC_INVALID_RESPONSE,
      message: 'Invalid JSON-RPC result type.',
      context: { method, resultType: typeof value },
    });
  }
}
