import { ASSET_TYPE } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import { renderHook, waitFor } from '@testing-library/react-native';
import { isValidAddress } from './address';
import { useAddCustomToken } from './asset';
import { useAssetSearch } from './assetSearch';
import { getAssetService, type INftCollection } from './core';
import { mockAsset } from './mocks/fixtures';

jest.mock('./core', () => ({ getAssetService: jest.fn() }));
jest.mock('./asset', () => ({ useAddCustomToken: jest.fn() }));
jest.mock('./address', () => ({ isValidAddress: jest.fn(() => true) }));

const contractAddress = '0x0000000000000000000000000000000000000001';
const nftCollections: INftCollection[] = [
  { id: 'nft_1', networkId: 'net_1', contractAddress: '0xabc', type: ASSET_TYPE.ERC721, name: 'Test NFT', symbol: 'TEST', icon: null },
];
const options = {
  text: contractAddress,
  assets: [],
  nftCollections,
  includeNfts: false,
  network: { id: 'net_1', networkType: NetworkType.Ethereum },
  addressId: 'addr_1',
  isLoadingLocalAssets: false,
};

describe('asset search receive policy', () => {
  const inspectContractAsset = jest.fn();
  const addCustomToken = jest.fn();

  beforeEach(() => {
    (getAssetService as jest.Mock).mockReturnValue({ inspectContractAsset });
    (useAddCustomToken as jest.Mock).mockReturnValue(addCustomToken);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('filters NFT collections for receive while preserving send search results', async () => {
    const assets = [mockAsset, { ...mockAsset, id: 'nft_asset', type: ASSET_TYPE.ERC721 }];
    const { result, rerender } = renderHook(({ includeNfts }: { includeNfts: boolean }) => useAssetSearch({ ...options, text: 'test', assets, includeNfts }), {
      initialProps: { includeNfts: true },
    });

    await waitFor(() => expect(result.current.items.map((item) => item.key)).toEqual(['token:asset_1', 'nft:nft_1']));

    rerender({ includeNfts: false });
    expect(result.current.items.map((item) => item.key)).toEqual(['token:asset_1']);
    expect(addCustomToken).not.toHaveBeenCalled();
  });

  it('rejects an NFT contract before adding a custom token', async () => {
    inspectContractAsset.mockResolvedValue({ assetType: ASSET_TYPE.ERC721 });
    const { result } = renderHook(() => useAssetSearch(options));

    await waitFor(() => expect(result.current.status).toBe('invalid-ERC20'));

    expect(inspectContractAsset).toHaveBeenCalledWith({ addressId: 'addr_1', contractAddress });
    expect(addCustomToken).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it('allows a valid ERC20 contract through receive search', async () => {
    inspectContractAsset.mockResolvedValue({ assetType: ASSET_TYPE.ERC20 });
    addCustomToken.mockResolvedValue(mockAsset);
    const { result } = renderHook(() => useAssetSearch(options));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(isValidAddress).toHaveBeenCalledWith({ networkType: NetworkType.Ethereum, addressValue: contractAddress });
    expect(addCustomToken).toHaveBeenCalledWith({ addressId: 'addr_1', contractAddress });
    expect(result.current.items[0]?.key).toBe('token:asset_1');
  });
});
