export const buildScanOpenApiKey = (params: { networkType: string; chainId: string }): string => `${params.networkType}:${params.chainId}`;
export const NFT_ITEMS_PAGE_SIZE = 100;
export const NFT_COLLECTIONS_PAGE_SIZE = 100;

type ScanPage<T> = { total: number; list: T[]; next?: string | number | null };

type ScanResponse<T> = {
  status: string;
  message?: string;
  result: ScanPage<T>;
};

export async function fetchScanPage<T>(url: URL): Promise<ScanPage<T>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ConfluxScan OpenAPI HTTP error: ${response.status}`);

  const data = (await response.json()) as ScanResponse<T>;
  if (data.status !== '1') throw new Error(data.message || 'ConfluxScan OpenAPI error');
  return data.result;
}

export type ScanNftItem = {
  tokenId: string;
  name?: string;
  description?: string | null;
  image?: string | null;
  amount: string;
};

export async function fetchNftItemsPageFromConfluxScan(params: {
  baseUrl: string;
  ownerAddress: string;
  contractAddress: string;
  cursor: string;
}): Promise<{ list: ScanNftItem[]; nextCursor: string | null }> {
  const url = new URL('/nft/tokens', params.baseUrl);
  url.searchParams.set('contract', params.contractAddress);
  url.searchParams.set('owner', params.ownerAddress);
  url.searchParams.set('cursor', params.cursor);
  url.searchParams.set('limit', String(NFT_ITEMS_PAGE_SIZE));
  url.searchParams.set('sort', 'ASC');
  url.searchParams.set('sortField', 'latest_update_time');
  url.searchParams.set('withBrief', 'true');
  url.searchParams.set('withMetadata', 'false');
  url.searchParams.set('suppressMetadataError', 'true');

  const page = await fetchScanPage<ScanNftItem>(url);
  // Scan mixes number and string cursors. Keep large string cursors intact.
  const cursor = page.next == null ? null : String(page.next);
  // Scan returns the last row's cursor even when this is the final page.
  const hasMore = page.list.length >= NFT_ITEMS_PAGE_SIZE && (params.cursor !== '0' || page.list.length < page.total);
  const nextCursor = hasMore && cursor && cursor !== '0' ? cursor : null;
  return { list: page.list, nextCursor };
}
