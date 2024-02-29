import { createFetchServer } from '@cfx-kit/dapp-utils/dist/fetch';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID, CFX_ESPACE_MAINNET_SCAN_OPENAPI, CFX_ESPACE_TESTNET_SCAN_OPENAPI } from '@core/consts/network';
import { type NFTItemDetail } from '..';

const responseHandler = (res: {
  status: '0' | '1';
  message: string;
  result?: { list: Array<{ amount: string; description: string; image: string; name: string; tokenId: string }> };
}) => {
  if (res?.result?.list) {
    return res.result.list.map(
      (item) => ({ amount: item.amount, description: item.description, icon: item.image, name: item.name, tokenId: item.tokenId }) as NFTItemDetail,
    );
  }
  return null;
};
const fetchESpaceScanTestnet = createFetchServer({ prefixUrl: CFX_ESPACE_TESTNET_SCAN_OPENAPI, responseHandler });
const fetchESpaceScanMainnet = createFetchServer({ prefixUrl: CFX_ESPACE_MAINNET_SCAN_OPENAPI, responseHandler });

const abortController = new AbortController();

export const fetchNFTDetail = async ({ isTestnet, accountAddress, nftAddress }: { isTestnet: boolean; accountAddress: string; nftAddress: string }) => {
  abortController.abort();
  const fetchESpaceScan = !isTestnet ? fetchESpaceScanMainnet : fetchESpaceScanTestnet;
  const fetchKey = `nftDetail-${nftAddress}-${accountAddress}-${isTestnet ? CFX_ESPACE_TESTNET_CHAINID : CFX_ESPACE_MAINNET_CHAINID}`;
  return fetchESpaceScan.fetchServer<Array<NFTItemDetail>>({
    url: `nft/tokens?contract=${nftAddress}&owner=${accountAddress}&cursor=0&limit=100&sort=ASC&sortField=latest_update_time&withBrief=true&withMetadata=false&suppressMetadataError=true`,
    key: fetchKey,
    options: {
      signal: abortController.signal,
    },
  });
};
