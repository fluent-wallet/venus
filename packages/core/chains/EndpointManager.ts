import { injectable } from 'inversify';

/**
 * Holds the active RPC endpoint for a specific Network record (WatermelonDB Network.id).
 */
@injectable()
export class EndpointManager {
  private readonly endpointsByNetworkId = new Map<string, string>();

  setEndpoint(networkId: string, endpoint: string): void {
    this.endpointsByNetworkId.set(networkId, endpoint);
  }

  getEndpoint(networkId: string): string | undefined {
    if (!networkId) return undefined;
    return this.endpointsByNetworkId.get(networkId);
  }

  getEndpointOrThrow(networkId: string): string {
    const endpoint = this.getEndpoint(networkId);
    if (!endpoint) {
      throw new Error(`EndpointManager: endpoint is not set for networkId=${networkId}`);
    }
    return endpoint;
  }

  clearEndpoint(networkId: string): void {
    if (!networkId) return;
    this.endpointsByNetworkId.delete(networkId);
  }

  clearAll(): void {
    this.endpointsByNetworkId.clear();
  }
}
