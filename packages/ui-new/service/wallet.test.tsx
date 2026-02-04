import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useCurrentAccount } from './account';
import { getVaultService } from './core';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
import { getHasVaultKey, useHasVault, useWalletReady } from './wallet';

jest.mock('./core', () => ({ getVaultService: jest.fn() }));
jest.mock('./account', () => ({ useCurrentAccount: jest.fn() }));

type VaultServiceMock = {
  hasAnyVault: jest.Mock;
};

describe('wallet service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: VaultServiceMock;
  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      hasAnyVault: jest.fn(),
    };
    (getVaultService as jest.Mock).mockReturnValue(service);
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useHasVault mirrors VaultService.hasAnyVault result', async () => {
    service.hasAnyVault.mockResolvedValue(true);
    const { result } = renderHook(() => useHasVault(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
    expect(queryClient.getQueryData(getHasVaultKey())).toBe(true);
  });

  it('useWalletReady returns true when no vault exists', async () => {
    service.hasAnyVault.mockResolvedValue(false);
    (useCurrentAccount as jest.Mock).mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useWalletReady(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('useWalletReady returns false when vault exists but no account selected', async () => {
    service.hasAnyVault.mockResolvedValue(true);
    (useCurrentAccount as jest.Mock).mockReturnValue({ data: null, isLoading: false, error: null });

    const { result } = renderHook(() => useWalletReady(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(false);
  });

  it('useWalletReady returns true when both vault and account ready', async () => {
    service.hasAnyVault.mockResolvedValue(true);
    (useCurrentAccount as jest.Mock).mockReturnValue({ data: { id: 'acc_1' }, isLoading: false, error: null });

    const { result } = renderHook(() => useWalletReady(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe(true);
  });

  it('useWalletReady propagates loading state', async () => {
    service.hasAnyVault.mockResolvedValue(true);
    (useCurrentAccount as jest.Mock).mockReturnValue({ data: null, isLoading: true, error: null });

    const { result } = renderHook(() => useWalletReady(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toBe(false);
  });

  it('useWalletReady propagates error state', () => {
    const error = new Error('boom');
    service.hasAnyVault.mockResolvedValue(true);
    (useCurrentAccount as jest.Mock).mockReturnValue({ data: null, isLoading: false, error });

    const { result } = renderHook(() => useWalletReady(), { wrapper });

    expect(result.current.data).toBe(false);
    expect(result.current.error).toBe(error);
  });

  describe('error handling', () => {
    it('useHasVault handles service errors', async () => {
      const error = new Error('Database unavailable');
      service.hasAnyVault.mockRejectedValue(error);

      const { result } = renderHook(() => useHasVault(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(error);
    });

    it('useWalletReady reflects hasVault query error', async () => {
      const error = new Error('Query failed');
      service.hasAnyVault.mockRejectedValue(error);
      (useCurrentAccount as jest.Mock).mockReturnValue({ data: null, isLoading: false, error: null });

      const { result } = renderHook(() => useWalletReady(), { wrapper });

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.error).toEqual(error);
    });
  });
});
