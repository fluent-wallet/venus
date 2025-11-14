import type { ChainType, NetworkType } from '@core/database/models/Network';

export interface NetworkEndpointEntry {
  endpoint: string;
  type: 'inner' | 'outer';
}

/**
 * Plain network shape exposed to the UI layer.
 */
export interface INetwork {
  id: string;
  name: string;
  endpoint: string;
  endpointsList: NetworkEndpointEntry[];
  netId: number;
  chainId: string;
  gasBuffer: number;
  networkType: NetworkType;
  chainType: ChainType;
  icon: string | null;
  scanUrl: string | null;
  selected: boolean;
  builtin: boolean | null;
}
