import { ASSET_TYPE } from '@core/types';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { useCurrentAddress } from './account';
import { getNftService, getNftSyncService } from './core';
import { useNftCollectionsOfAddress, useNftCollectionsOfCurrentAddress, useNftItems } from './nft';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';

jest.mock('./core', () => ({
  getNftService: jest.fn(),
  getNftSyncService: jest.fn(),
}));
jest.mock('./account', () => ({ useCurrentAddress: jest.fn() }));

type NftServiceMock = {
  listCollections: jest.Mock;
  getItems: jest.Mock;
};

type NftSyncServiceMock = {
  setCurrentTarget: jest.Mock;
  clearCurrentTarget: jest.Mock;
};

describe('nft service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: NftServiceMock;
  let syncService: NftSyncServiceMock;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      listCollections: jest.fn().mockResolvedValue([
        {
          id: 'col_1',
          networkId: 'net_1',
          contractAddress: '0xabc',
          type: ASSET_TYPE.ERC721,
          name: 'NFT',
          symbol: 'NFT',
          icon: null,
        },
      ]),
      getItems: jest.fn().mockResolvedValue([{ tokenId: '1', amount: '1', name: 'NFT #1', icon: null }]),
    };
    syncService = {
      setCurrentTarget: jest.fn(),
      clearCurrentTarget: jest.fn(),
    };

    (getNftService as jest.Mock).mockReturnValue(service);
    (getNftSyncService as jest.Mock).mockReturnValue(syncService);
    (useCurrentAddress as jest.Mock).mockReturnValue({ data: { id: 'addr_1' }, isSuccess: true });
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useNftCollectionsOfAddress loads collections by address', async () => {
    const { result } = renderHook(() => useNftCollectionsOfAddress('addr_1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listCollections).toHaveBeenCalledWith({ addressId: 'addr_1' });
  });

  it('useNftCollectionsOfCurrentAddress uses current address id', async () => {
    const { result } = renderHook(() => useNftCollectionsOfCurrentAddress(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listCollections).toHaveBeenCalledWith({ addressId: 'addr_1' });
  });

  it('useNftItems registers sync target and clears it on unmount', async () => {
    const { result, unmount } = renderHook(
      () =>
        useNftItems({
          addressId: 'addr_1',
          contractAddress: '0xABC',
          enabled: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(syncService.setCurrentTarget).toHaveBeenCalledWith({ contractAddress: '0xABC' });
    expect(service.getItems).toHaveBeenCalledWith({ addressId: 'addr_1', contractAddress: '0xABC' });

    unmount();

    expect(syncService.clearCurrentTarget).toHaveBeenCalledWith({ contractAddress: '0xABC' });
  });

  it('useNftItems stays idle when disabled', async () => {
    const { result } = renderHook(
      () =>
        useNftItems({
          addressId: 'addr_1',
          contractAddress: '0xABC',
          enabled: false,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(syncService.setCurrentTarget).not.toHaveBeenCalled();
    expect(syncService.clearCurrentTarget).not.toHaveBeenCalled();
    expect(service.getItems).not.toHaveBeenCalled();
  });
});
