import { createContract } from '@cfx-kit/dapp-utils/dist/contract';
import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { CFX_ESPACE_MAINNET_TOKEN_LIST_CONTRACT_ADDRESS, CFX_ESPACE_TESTNET_TOKEN_LIST_CONTRACT_ADDRESS } from '../../../../consts/network';
import ESpaceTokenListABI from '../../../../contracts/ABI/ESpaceTokenList';
import { eSpaceTestnetServerFetcher, eSpaceServerFetcher } from '../../AssetsTracker/fetchers/eSpaceServer';
import { type AssetInfo } from '../../AssetsTracker/types';

export const eSpaceTestnetTokenListContract = createContract({ address: CFX_ESPACE_TESTNET_TOKEN_LIST_CONTRACT_ADDRESS, ABI: ESpaceTokenListABI });
export const eSpaceTokenListContract = createContract({ address: CFX_ESPACE_MAINNET_TOKEN_LIST_CONTRACT_ADDRESS, ABI: ESpaceTokenListABI });

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
      (item) => ({ contractAddress: item.contract, name: item.name, symbol: item.symbol, decimals: item.decimals, icon: item.iconUrl }) as AssetInfo,
    );
  });
};
