import { HttpJsonRpcClient } from '@core/rpc';
import { Interface } from 'ethers';
import { defer, firstValueFrom, retry } from 'rxjs';
import ESpaceTokenListABI from '../../../../contracts/ABI/ESpaceTokenList';
import { AssetType } from '../../../../database/models/Asset';
import { eSpaceServer, eSpaceTestnetServer } from '../../AssetsTracker/fetchers/eSpaceServer';
import type { AssetInfo } from '../../AssetsTracker/types';

const tokenListInterface = new Interface(ESpaceTokenListABI);

export const fetchReceiveAssets = async ({ endpoint, isTestnet }: { endpoint: string; isTestnet: boolean }): Promise<AssetInfo[]> => {
  const contractAddress = isTestnet ? '0xcd54f022b0355e00db610f6b3411c76b5c61320f' : '0xf1a8b97ef61bf8fe3c54c94a16c57c0f7afc2277';
  const server = isTestnet ? eSpaceTestnetServer : eSpaceServer;
  const rpc = new HttpJsonRpcClient(endpoint);
  const raw = await firstValueFrom(
    defer(() =>
      rpc.request<string>('eth_call', [{ to: contractAddress, data: tokenListInterface.encodeFunctionData('listTokens', [20n, 0n, 200n]) }, 'latest']),
    ).pipe(retry({ count: 3, delay: 1_000 })),
  );
  const addressList = tokenListInterface.decodeFunctionResult('listTokens', raw)[1];
  if (addressList.length === 0) return [];
  const { result } = await server.get('token/tokeninfos', { searchParams: { contracts: addressList.join(',') } }).json<{
    message: string;
    result?: Array<{ contract: string; name: string; symbol: string; decimals: number; iconUrl?: string }>;
  }>();
  return (result ?? []).map((item) => ({
    contractAddress: item.contract,
    name: item.name,
    symbol: item.symbol,
    decimals: item.decimals,
    icon: item.iconUrl,
    type: AssetType.ERC20,
    balance: '0',
  }));
};
