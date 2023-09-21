import { enrichFetch } from '../utils';
import { CFX_SCAN_API_HOSTS } from '../Consts/network';

// request api key
// https://docs.opensea.io/reference/api-keys
const openseaApiKey = '';

const getQueryString = (params) => {
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
  constructor({ network }) {
    this.network = network;
    this.isCfx = network.networkType === 'cfx';
    this.scanHost = CFX_SCAN_API_HOSTS[network.netId] || '';
    this.isTestnet = !!network.isTestnet;
  }

  async getCfxNftDetails({ contract, tokenId, withMetadata = false }) {
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
  async getCfxNftTokenIds({ owner, contract, skip = 0, limit = 10, sort = 'DESC', sortField = 'latest_update_time' }) {
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
  async getCfxNftBalances({ owner, skip = 0, limit = 10 }) {
    const query = getQueryString({ owner, skip, limit });
    const res = await enrichFetch({
      url: `${this.scanHost}/nft/balances${query}`,
      method: 'GET',
    });
    return res;
  }
  // https://docs.opensea.io/v1.0/reference/getting-assets
  async getEthNftBalances({ owner }) {
    const api = this.isTestnet ? 'https://testnets-api.opensea.io/api/v1/assets' : 'https://api.opensea.io/api/v1/assets';

    const headers = this.isTestnet
      ? {}
      : {
          'X-API-KEY': openseaApiKey,
        };
    return enrichFetch({
      url: `${api}?owner=${owner}`,
      method: 'GET',
      headers,
    });
  }
  // https://docs.opensea.io/v1.0/reference/retrieving-a-single-asset-testnets
  async getETHhNftDetail({ contract, tokenId }) {
    const api = this.isTestnet ? 'https://testnets-api.opensea.io/api/v1/asset' : 'https://api.opensea.io/api/v1/asset';

    const headers = this.isTestnet
      ? {}
      : {
          'X-API-KEY': openseaApiKey,
        };
    return enrichFetch({
      url: `${api}/${contract}/${tokenId}`,
      method: 'GET',
      headers,
    });
  }
}

export default NFT;
