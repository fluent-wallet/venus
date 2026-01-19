export type NftSyncKey = { addressId: string; networkId: string; contractAddress: string };
export type NftSyncReason = 'manual' | 'poll' | 'start';

export type NftSyncErrorSnapshot = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

export type NftSyncItemDetail = {
  name: string;
  description?: string | null;
  icon?: string | null;
  amount: string;
  tokenId: string;
};

export type NftSyncSnapshot = {
  contractAddress: string;
  items: NftSyncItemDetail[];
};
export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const buildScanOpenApiKey = (params: { networkType: string; chainId: string }): string => `${params.networkType}:${params.chainId}`;

export type NftFetcherParams = {
  baseUrl: string;
  ownerAddress: string;
  contractAddress: string;
  signal?: AbortSignal;
  fetchFn?: FetchFunction;
};

export type NftFetcher = (params: NftFetcherParams) => Promise<NftSyncItemDetail[]>;
