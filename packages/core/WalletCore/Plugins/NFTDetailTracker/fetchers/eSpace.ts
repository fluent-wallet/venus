import { Networks } from '@core/utils/consts';
import ky from 'ky';
import type { NFTItemDetail } from '../server';

type NFTDetailResponse = {
  status: '0' | '1';
  message: string;
  result?: { list: Array<{ amount: string; description: string; image: string; name: string; tokenId: string }> };
};

const responseHandler = (res: NFTDetailResponse) => {
  if (res?.result?.list) {
    return res.result.list.map(
      (item) => ({ amount: item.amount, description: item.description, icon: item.image, name: item.name, tokenId: item.tokenId }) as NFTItemDetail,
    );
  }
  return [];
};
const eSpaceScanTestnet = ky.create({ prefixUrl: Networks['eSpace Testnet'].scanOpenAPI });
const eSpaceScanMainnet = ky.create({ prefixUrl: Networks['Conflux eSpace'].scanOpenAPI });

const abortController = new AbortController();

export const fetchNFTDetail = async ({ isTestnet, accountAddress, nftAddress }: { isTestnet: boolean; accountAddress: string; nftAddress: string }) => {
  abortController.abort();
  const server = isTestnet ? eSpaceScanTestnet : eSpaceScanMainnet;
  const response = await server
    .get('nft/tokens', {
      searchParams: {
        contract: nftAddress,
        owner: accountAddress,
        cursor: 0,
        limit: 100,
        sort: 'ASC',
        sortField: 'latest_update_time',
        withBrief: true,
        withMetadata: false,
        suppressMetadataError: true,
      },
      signal: abortController.signal,
    })
    .json<NFTDetailResponse>();
  return responseHandler(response);
};
