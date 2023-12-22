import { Subject } from 'rxjs';
import { createFetchServer } from '@cfx-kit/dapp-utils/dist/fetch';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_MAINNET_SCAN_OPENAPI, CFX_ESPACE_TESTNET_SCAN_OPENAPI } from '@core/consts/network';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { type Network } from '@core/database/models/Network/index';
import { type Address } from '@core/database/models/Address/index';

export interface NFTItemDetail {
  name: string;
  description?: string | null;
  icon?: string | null;
  amount: string;
  tokenId: string;
}

export type NFTWithDetail = AssetInfo & { detail: NFTItemDetail };
export const fetchNFTDetailSubject = new Subject<string | undefined>();

const responseHandler = (res: {
  status: '0' | '1';
  message: string;
  result?: { list: Array<{ amount: string; description: string; image: string; name: string; tokenId: string }> };
}) => {
  if (res?.result?.list) {
    return res.result.list.map(
      (item) => ({ amount: item.amount, description: item.description, icon: item.image, name: item.name, tokenId: item.tokenId } as NFTItemDetail)
    );
  }
  return null;
};
const fetchESpaceScanTestnet = createFetchServer({ prefixUrl: CFX_ESPACE_TESTNET_SCAN_OPENAPI, responseHandler });
const fetchESpaceScanMainnet = createFetchServer({ prefixUrl: CFX_ESPACE_MAINNET_SCAN_OPENAPI, responseHandler });

const abortController = new AbortController();

export const updateNFTDetail = (nftContractAddress?: string) => {
  fetchNFTDetailSubject.next(nftContractAddress);
};

export const fetchNFTDetail = async ({ currentNetwork, currentAddress, nft }: { currentNetwork: Network; currentAddress: Address; nft: AssetInfo }) => {
  abortController.abort();
  const fetchESpaceScan = currentNetwork?.chainId === CFX_ESPACE_MAINNET_CHAINID ? fetchESpaceScanMainnet : fetchESpaceScanTestnet;
  const fetchKey = `nftDetail-${nft.contractAddress}-${currentAddress?.hex}-${currentNetwork?.chainId}`;
  return fetchESpaceScan.fetchServer<Array<NFTItemDetail>>({
    url: `nft/tokens?contract=${nft.contractAddress}&owner=${currentAddress.hex}&cursor=0&limit=100&sort=ASC&sortField=latest_update_time&withBrief=true&withMetadata=false&suppressMetadataError=true`,
    key: fetchKey,
    options: {
      retry: 4,
      signal: abortController.signal,
    },
  });
};
