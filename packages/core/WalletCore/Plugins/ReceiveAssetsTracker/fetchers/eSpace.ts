import { createContract } from '@cfx-kit/dapp-utils/dist/contract';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { AssetType } from '../../../../database/models/Asset';
import ESpaceTokenListABI from '../../../../contracts/ABI/ESpaceTokenList';
import { eSpaceTestnetServerFetcher, eSpaceServerFetcher } from '../../AssetsTracker/fetchers/eSpaceServer';
import { type AssetInfo } from '../../AssetsTracker/types';

export const eSpaceTestnetTokenListContract = createContract({ address: '0xcd54f022b0355e00db610f6b3411c76b5c61320f', ABI: ESpaceTokenListABI });
export const eSpaceTokenListContract = createContract({ address: '0xf1a8b97ef61bf8fe3c54c94a16c57c0f7afc2277', ABI: ESpaceTokenListABI });

export const fetchReceiveAssets = ({ endpoint, isTestnet }: { endpoint: string; isTestnet: boolean }) => {
  const contract = isTestnet ? eSpaceTestnetTokenListContract : eSpaceTokenListContract;
  const serverFetcher = isTestnet ? eSpaceTestnetServerFetcher : eSpaceServerFetcher;
  return fetchChain<string>({
    url: endpoint,
    method: 'eth_call',
    options: {
      retry: 3,
    },
    params: [
      {
        to: contract.address,
        data: contract.encodeFunctionData('listTokens', [20n, 0n, 200n]),
      },
    ],
  }).then(async (res) => {
    const [_, addressList] = contract.decodeFunctionResult('listTokens', res);
    if (!Array.isArray(addressList) || addressList.length === 0) return [];
    const { result } = await serverFetcher.fetchServer<{
      message: string;
      result: Array<{ contract: string; name: string; symbol: string; decimals: number; iconUrl?: string }>;
    }>({
      key: `eSpace-${isTestnet ? 'testnet' : 'mainnet'}-receive-asset`,
      url: `token/tokeninfos?contracts=${addressList.join(',')}`,
    });
    return result?.map(
      (item) =>
        ({
          contractAddress: item.contract,
          name: item.name,
          symbol: item.symbol,
          decimals: item.decimals,
          icon: item.iconUrl,
          type: AssetType.ERC20,
        }) as AssetInfo,
    );
  });
};
