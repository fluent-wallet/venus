import type { EndpointManager } from '@core/chains/EndpointManager';
import type { ChainRpcRequestOptions, IChainRpc } from '@core/types';
import type { HttpJsonRpcClientOptions } from './HttpJsonRpcClient';
import { HttpJsonRpcClient } from './HttpJsonRpcClient';

/**
 * IChainRpc implementation that resolves endpoint at call time from EndpointManager.
 */
export class DynamicHttpJsonRpcClient implements IChainRpc {
  private readonly endpointManager: EndpointManager;
  private readonly networkId: string;
  private readonly options: HttpJsonRpcClientOptions;

  private cachedEndpoint: string | null = null;
  private cachedClient: HttpJsonRpcClient | null = null;
  constructor(params: { endpointManager: EndpointManager; networkId: string; options?: HttpJsonRpcClientOptions }) {
    if (!params.networkId) {
      throw new Error('DynamicHttpJsonRpcClient: networkId is required');
    }
    this.endpointManager = params.endpointManager;
    this.networkId = params.networkId;
    this.options = params.options ?? {};
  }

  private getClient(): HttpJsonRpcClient {
    const endpoint = this.endpointManager.getEndpointOrThrow(this.networkId);

    if (this.cachedClient && this.cachedEndpoint === endpoint) {
      return this.cachedClient;
    }

    const client = new HttpJsonRpcClient(endpoint, this.options);
    this.cachedEndpoint = endpoint;
    this.cachedClient = client;
    return client;
  }

  async request<T = unknown>(method: string, params?: unknown, options?: ChainRpcRequestOptions): Promise<T> {
    const client = this.getClient();
    return client.request<T>(method, params, options);
  }

  async batch<T = unknown>(requests: readonly { method: string; params?: unknown }[], options?: ChainRpcRequestOptions): Promise<T[]> {
    const client = this.getClient();
    return client.batch<T>(requests, options);
  }
}
