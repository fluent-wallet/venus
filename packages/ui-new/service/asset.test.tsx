import { AssetType } from '@core/types';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { useCurrentAddress } from './account';
import {
  getAssetRootKey,
  getAssetsByAddressKey,
  useAddCustomToken,
  useAssetsOfAddress,
  useAssetsOfCurrentAddress,
  useAssetsSummaryOfAddress,
  useAssetsSummaryOfCurrentAddress,
} from './asset';
import { getAssetService, type IAsset } from './core';
import { mockAsset } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';

jest.mock('./core', () => ({ getAssetService: jest.fn() }));
jest.mock('./account', () => ({ useCurrentAddress: jest.fn() }));

type AssetServiceMock = {
  getAssetsByAddress: jest.Mock;
  addCustomToken: jest.Mock;
};

describe('asset service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: AssetServiceMock;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      getAssetsByAddress: jest.fn(),
      addCustomToken: jest.fn().mockResolvedValue(mockAsset),
    };
    (getAssetService as jest.Mock).mockReturnValue(service);
    (useCurrentAddress as jest.Mock).mockReturnValue({ data: { id: 'addr_1' }, isSuccess: true });
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useAssetsOfAddress caches by address key', async () => {
    service.getAssetsByAddress.mockResolvedValue([mockAsset]);
    const { result } = renderHook(() => useAssetsOfAddress('addr_1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.getAssetsByAddress).toHaveBeenCalledWith('addr_1');
    expect(queryClient.getQueryData(getAssetsByAddressKey('addr_1'))).toEqual([mockAsset]);
  });

  it('useAssetsOfCurrentAddress uses current address id and disables when empty', async () => {
    service.getAssetsByAddress.mockResolvedValue([mockAsset]);
    const { result } = renderHook(() => useAssetsOfCurrentAddress(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.getAssetsByAddress).toHaveBeenCalledWith('addr_1');
  });

  it('useAssetsSummaryOfAddress maps totals and flags', async () => {
    service.getAssetsByAddress.mockResolvedValue([mockAsset, { ...mockAsset, id: 'asset_2', type: AssetType.ERC721, priceValue: '5' }]);

    const { result } = renderHook(() => useAssetsSummaryOfAddress('addr_1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ totalValue: '7', hasTokens: true, hasNFTs: true });
  });

  it('useAssetsSummaryOfCurrentAddress reuses derived address', async () => {
    service.getAssetsByAddress.mockResolvedValue([mockAsset]);

    const { result } = renderHook(() => useAssetsSummaryOfCurrentAddress(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(service.getAssetsByAddress).toHaveBeenCalledWith('addr_1');
  });

  it('useAddCustomToken invalidates asset caches and returns service result', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useAddCustomToken(), { wrapper });

    let added: IAsset | undefined;
    await act(async () => {
      added = await result.current({ addressId: 'addr_1', contractAddress: '0x123', decimals: 18, symbol: 'T' });
    });

    expect(service.addCustomToken).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAssetRootKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAssetsByAddressKey('addr_1') });
    expect(added).toEqual(mockAsset);
  });

  it('useAssetsOfCurrentAddress disables query when no current address', async () => {
    (useCurrentAddress as jest.Mock).mockReturnValue({ data: null });
    const { result } = renderHook(() => useAssetsOfCurrentAddress(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.getAssetsByAddress).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });

  describe('error handling', () => {
    it('useAssetsOfAddress handles service errors', async () => {
      const error = new Error('Failed to fetch assets');
      service.getAssetsByAddress.mockRejectedValue(error);

      const { result } = renderHook(() => useAssetsOfAddress('addr_1'), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(error);
    });

    it('useAddCustomToken propagates errors', async () => {
      const error = new Error('Token already exists');
      service.addCustomToken.mockRejectedValue(error);
      const { result } = renderHook(() => useAddCustomToken(), { wrapper });

      await expect(
        act(async () => {
          await result.current({ addressId: 'addr_1', contractAddress: '0x123', decimals: 18, symbol: 'T' });
        }),
      ).rejects.toThrow('Token already exists');
    });

    it('useAssetsSummaryOfAddress handles empty assets gracefully', async () => {
      service.getAssetsByAddress.mockResolvedValue([]);

      const { result } = renderHook(() => useAssetsSummaryOfAddress('addr_1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ totalValue: '0', hasTokens: false, hasNFTs: false });
    });
  });
});
