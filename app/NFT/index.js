// import initSend from '../utils/send';
import {enrichFetch} from '../utils';
import {
  CFX_ESPACE_MAINNET_CHAINID,
  CFX_ESPACE_TESTNET_CHAINID,
  CFX_SCAN_API_HOSTS,
} from '../Consts/network';

const getQueryString = params => {
  let str = '';
  Object.keys(params).forEach((k, index) => {
    if (index === 0) {
      str += `?${k}=${params[k]}`;
    } else {
      str += `&${k}=${params[k]}`;
    }
  });
  return str;
};

class NFT {
  constructor({network}) {
    this.network = network;
    this.isCfx = network.networkType === 'cfx';
    this.scanHost = CFX_SCAN_API_HOSTS[network.netId] || '';
  }

  async getCfxNftDetails({contract, tokenId, withMetadata = false}) {
    const query = getQueryString({
      contract,
      tokenId,
      withMetadata,
    });
    const res = await enrichFetch({
      url: `${this.scanHost}/nft/preview${query}`,
      method: 'GET',
    });
    return res;
  }
  // get id of given nft contract
  async getCfxNftTokenIds({
    owner,
    contract,
    skip = 0,
    limit = 10,
    sort = 'DESC',
    sortField = 'latest_update_time',
  }) {
    const query = getQueryString({
      owner,
      contract,
      skip,
      limit,
      sort,
      sortField,
    });
    const res = await enrichFetch({
      url: `${this.scanHost}/nft/tokens${query}`,
      method: 'GET',
    });
    return res;
  }

  // get all nft of address
  async getCfxNftBalances({owner, skip = 0, limit = 10}) {
    const query = getQueryString({owner, skip, limit});
    const res = await enrichFetch({
      url: `${this.scanHost}/nft/balances${query}`,
      method: 'GET',
    });
    return res;
  }

  getNfts(owner) {
    if (
      this.isCfx ||
      this.network.chainId === CFX_ESPACE_MAINNET_CHAINID ||
      this.network.chainId === CFX_ESPACE_TESTNET_CHAINID
    ) {
      return;
    }
  }
}

export default NFT;
