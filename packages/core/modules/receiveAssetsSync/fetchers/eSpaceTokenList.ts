import ESpaceTokenList from '@core/contracts/ABI/ESpaceTokenList';
import { CoreError, RECEIVE_ASSETS_SYNC_DECODE_FAILED, RECEIVE_ASSETS_SYNC_FETCH_FAILED } from '@core/errors';
import type { IChainProvider } from '@core/types';
import { Interface } from '@ethersproject/abi';

const tokenListIface = new Interface(ESpaceTokenList);
export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type ESpaceConfig = {
  tokenListContract: string;
  scanOpenApiBaseUrl: string;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const fetchESpaceOfficialTokens = async (params: {
  provider: IChainProvider;
  config: ESpaceConfig;
  fetchFn?: FetchFunction;
}): Promise<Array<{ contractAddress: string; name: string; symbol: string; decimals: number; icon?: string }>> => {
  const { provider, config } = params;

  let data: string;
  try {
    data = tokenListIface.encodeFunctionData('listTokens', [20n, 0n, 200n]);
  } catch (error) {
    throw new CoreError({
      code: RECEIVE_ASSETS_SYNC_DECODE_FAILED,
      message: 'Failed to encode token list call data.',
      cause: error,
      context: { method: 'listTokens' },
    });
  }

  let raw: string;
  try {
    raw = await provider.call({ to: config.tokenListContract, data: data as `0x${string}` });
  } catch (error) {
    throw new CoreError({
      code: RECEIVE_ASSETS_SYNC_FETCH_FAILED,
      message: 'Token list call failed.',
      cause: error,
      context: {
        chainId: provider.chainId,
        networkType: provider.networkType,
        tokenListContract: config.tokenListContract,
        method: 'provider.call',
      },
    });
  }

  let decoded: unknown;
  try {
    decoded = tokenListIface.decodeFunctionResult('listTokens', raw);
  } catch (error) {
    throw new CoreError({
      code: RECEIVE_ASSETS_SYNC_DECODE_FAILED,
      message: 'Failed to decode token list response.',
      cause: error,
      context: { method: 'listTokens' },
    });
  }

  const tokens = Array.isArray((decoded as any)?.[1]) ? ((decoded as any)[1] as string[]) : [];
  if (tokens.length === 0) return [];

  const url = new URL('/token/tokeninfos', config.scanOpenApiBaseUrl);
  url.searchParams.set('contracts', tokens.join(','));

  const resolvedFetch = params.fetchFn ?? globalThis.fetch;
  if (!resolvedFetch) {
    throw new CoreError({
      code: RECEIVE_ASSETS_SYNC_FETCH_FAILED,
      message: 'fetch is not available',
      context: { url: url.toString() },
    });
  }

  let res: Response;
  try {
    res = await resolvedFetch(url, { method: 'GET' });
  } catch (error) {
    throw new CoreError({
      code: RECEIVE_ASSETS_SYNC_FETCH_FAILED,
      message: 'Scan OpenAPI request failed.',
      cause: error,
      context: { url: url.toString() },
    });
  }

  if (!res.ok) {
    throw new CoreError({
      code: RECEIVE_ASSETS_SYNC_FETCH_FAILED,
      message: 'Scan OpenAPI HTTP error.',
      context: { url: url.toString(), status: res.status },
    });
  }

  const json = (await res.json()) as unknown;
  const list = isObject(json) && Array.isArray(json.result) ? json.result : null;

  if (!list) {
    throw new CoreError({
      code: RECEIVE_ASSETS_SYNC_FETCH_FAILED,
      message: 'Scan OpenAPI invalid response.',
      context: { url: url.toString() },
    });
  }

  return list.map((item) => ({
    contractAddress: String(item?.contract ?? ''),
    name: String(item?.name ?? ''),
    symbol: String(item?.symbol ?? ''),
    decimals: Number(item?.decimals ?? 18),
    icon: item?.iconUrl ? String(item.iconUrl) : undefined,
  }));
};
