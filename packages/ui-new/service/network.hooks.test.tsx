import type { NetworkEndpointEntry } from '@core/services/network/types';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { getNetworkService } from './core';
import { mockNetwork } from './mocks/fixtures';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
import {
  getCurrentNetworkKey,
  getNetworkListKey,
  getNetworkRootKey,
  useAddEndpoint,
  useCurrentNetwork,
  useNetworks,
  useRemoveEndpoint,
  useSwitchNetwork,
  useUpdateEndpoint,
} from './network';

jest.mock('./core', () => ({
  getNetworkService: jest.fn(),
}));

type NetworkServiceMock = {
  getCurrentNetwork: jest.Mock;
  getAllNetworks: jest.Mock;
  switchNetwork: jest.Mock;
  updateEndpoint: jest.Mock;
  addEndpoint: jest.Mock;
  removeEndpoint: jest.Mock;
};

describe('network service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: NetworkServiceMock;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      getCurrentNetwork: jest.fn(),
      getAllNetworks: jest.fn(),
      switchNetwork: jest.fn().mockResolvedValue(undefined),
      updateEndpoint: jest.fn().mockResolvedValue(undefined),
      addEndpoint: jest.fn().mockResolvedValue({ endpoint: 'https://rpc.new', type: 'outer' }),
      removeEndpoint: jest.fn().mockResolvedValue(true),
    };
    (getNetworkService as jest.Mock).mockReturnValue(service);
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useCurrentNetwork caches result under getCurrentNetworkKey', async () => {
    service.getCurrentNetwork.mockResolvedValue(mockNetwork);

    const { result } = renderHook(() => useCurrentNetwork(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockNetwork);
    expect(queryClient.getQueryData(getCurrentNetworkKey())).toEqual(mockNetwork);
  });

  it('useNetworks caches list under getNetworkListKey', async () => {
    service.getAllNetworks.mockResolvedValue([mockNetwork]);

    const { result } = renderHook(() => useNetworks(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockNetwork]);
    expect(queryClient.getQueryData(getNetworkListKey())).toEqual([mockNetwork]);
  });

  it('useSwitchNetwork calls service and invalidates root key', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSwitchNetwork(), { wrapper });

    await act(async () => {
      await result.current('net_2');
    });

    expect(service.switchNetwork).toHaveBeenCalledWith('net_2');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getNetworkRootKey() });
  });

  it('useUpdateEndpoint calls service and invalidates root key', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateEndpoint(), { wrapper });

    await act(async () => {
      await result.current('net_1', 'https://rpc.new');
    });

    expect(service.updateEndpoint).toHaveBeenCalledWith('net_1', 'https://rpc.new');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getNetworkRootKey() });
  });

  it('useAddEndpoint forwards service return value and invalidates cache', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useAddEndpoint(), { wrapper });
    const entry: NetworkEndpointEntry = { endpoint: 'https://rpc.new', type: 'outer' };

    const added = await result.current('net_1', entry);

    expect(service.addEndpoint).toHaveBeenCalledWith('net_1', entry);
    expect(added).toEqual({ endpoint: 'https://rpc.new', type: 'outer' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getNetworkRootKey() });
  });

  it('useRemoveEndpoint forwards boolean return value and invalidates cache', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRemoveEndpoint(), { wrapper });

    const removed = await result.current('net_1', 'https://rpc.old');

    expect(service.removeEndpoint).toHaveBeenCalledWith('net_1', 'https://rpc.old');
    expect(removed).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getNetworkRootKey() });
  });

  describe('error handling', () => {
    it('useCurrentNetwork handles service errors', async () => {
      const error = new Error('Network not found');
      service.getCurrentNetwork.mockRejectedValue(error);

      const { result } = renderHook(() => useCurrentNetwork(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(error);
    });

    it('useNetworks handles service errors', async () => {
      const error = new Error('Failed to load networks');
      service.getAllNetworks.mockRejectedValue(error);

      const { result } = renderHook(() => useNetworks(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(error);
    });

    it('useSwitchNetwork propagates errors', async () => {
      const error = new Error('Network switch failed');
      service.switchNetwork.mockRejectedValue(error);
      const { result } = renderHook(() => useSwitchNetwork(), { wrapper });

      await expect(
        act(async () => {
          await result.current('net_2');
        }),
      ).rejects.toThrow('Network switch failed');
    });

    it('useUpdateEndpoint propagates errors', async () => {
      const error = new Error('Invalid endpoint');
      service.updateEndpoint.mockRejectedValue(error);
      const { result } = renderHook(() => useUpdateEndpoint(), { wrapper });

      await expect(
        act(async () => {
          await result.current('net_1', 'invalid-url');
        }),
      ).rejects.toThrow('Invalid endpoint');
    });
  });
});
