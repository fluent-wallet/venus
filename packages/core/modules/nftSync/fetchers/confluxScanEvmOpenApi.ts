import type { NftFetcher, NftSyncItemDetail } from '../types';

type ScanTokenItem = {
  amount: string;
  description?: string | null;
  image?: string | null;
  name: string;
  tokenId: string;
};

type ScanResponse = {
  status: '0' | '1';
  message: string;
  result?: { list?: ScanTokenItem[] };
};

const normalizeItems = (list: unknown): NftSyncItemDetail[] => {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    name: String(item?.name ?? ''),
    description: item?.description ?? null,
    icon: item?.image ?? null,
    amount: String(item?.amount ?? '0'),
    tokenId: String(item?.tokenId ?? ''),
  }));
};

const isParameterWrongMessage = (message: string): boolean => message.includes('The parameter is wrong, please confirm it is correct');

export const fetchNftItemsFromConfluxScanEvmOpenApi: NftFetcher = async ({ baseUrl, ownerAddress, contractAddress, signal, fetchFn }) => {
  const resolvedFetch = fetchFn ?? globalThis.fetch;
  if (!resolvedFetch) {
    throw new Error('fetch is not available');
  }

  const url = new URL('/nft/tokens', baseUrl);
  url.searchParams.set('contract', contractAddress);
  url.searchParams.set('owner', ownerAddress);
  url.searchParams.set('cursor', '0');
  url.searchParams.set('limit', '100');
  url.searchParams.set('sort', 'ASC');
  url.searchParams.set('sortField', 'latest_update_time');
  url.searchParams.set('withBrief', 'true');
  url.searchParams.set('withMetadata', 'false');
  url.searchParams.set('suppressMetadataError', 'true');

  const res = await resolvedFetch(url, { method: 'GET', signal });
  if (!res.ok) {
    throw new Error(`ConfluxScan EVM OpenAPI HTTP error: ${res.status}`);
  }

  const json = (await res.json()) as ScanResponse;

  if (json?.status === '1') {
    return normalizeItems(json?.result?.list);
  }

  if (isParameterWrongMessage(String(json?.message ?? ''))) {
    return [];
  }

  throw new Error(String(json?.message ?? 'ConfluxScan EVM OpenAPI error'));
};
