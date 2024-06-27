import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { iface1155, iface721 } from '@core/contracts';
import { AssetType } from '@core/database/models/Asset';
import { networkRpcPrefixMap, networkRpcSuffixMap } from '@core/database/models/Network';
import { NetworkType } from '@core/utils/consts';

const ERC1155InterfaceId = '0xd9b67a26'; //https://eips.ethereum.org/EIPS/eip-1155
const ERC721InterfaceId = '0x80ac58cd'; // https://eips.ethereum.org/EIPS/eip-721

export type SupportType = AssetType;
export type UnknownType = 'Unknown';

export type Options = { networkType: NetworkType; endpoint: string; type?: SupportType[] };

const typeMap: Record<SupportType, { data: () => string; decode: (res: string) => any }> = {
  ERC1155: {
    data: () => iface1155.encodeFunctionData('supportsInterface', [ERC1155InterfaceId]),
    decode: (res: string) => iface1155.decodeFunctionResult('supportsInterface', res),
  },
  ERC721: {
    data: () => iface721.encodeFunctionData('supportsInterface', [ERC721InterfaceId]),
    decode: (res: string) => iface721.decodeFunctionResult('supportsInterface', res),
  },
};

export async function supportsInterface(
  contractAddress: string,
  { networkType, endpoint, type = [AssetType.ERC721, AssetType.ERC1155] }: Options,
): Promise<SupportType | UnknownType> {
  const rpcPrefix = networkRpcPrefixMap[networkType];
  const rpcSuffix = networkRpcSuffixMap[networkType];

  for (const t of type) {
    const data = typeMap[t].data();
    const decode = typeMap[t].decode;

    try {
      const result = await fetchChain<string>({
        url: endpoint,
        method: `${rpcPrefix}_call`,
        params: [{ to: contractAddress, data: data }, rpcSuffix],
      });

      const [bl] = decode(result);
      if (bl) return t;
    } catch (error) {
      // if get an error ,nothing to do
    }
  }

  return 'Unknown';
}
