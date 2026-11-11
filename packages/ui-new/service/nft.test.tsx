import { ASSET_TYPE } from '@core/types';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { type ComponentType, type ReactNode, StrictMode } from 'react';
import { AppState } from 'react-native';
import { getNftService, type INftCollection, type INftItemsPage } from './core';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
import { getNftAddressKey, getNftItemsKey, useNftCollectionsOfAddress, useNftItems, useNftListState } from './nft';

jest.mock('./core', () => ({ getNftService: jest.fn() }));

const originalAppState = AppState.currentState;
const nftItem = (tokenId: string, name = tokenId) => ({ tokenId, name, amount: '1' });
const nftPage = (tokenIds: string[], nextCursor: string | null = null): INftItemsPage => ({
  items: tokenIds.map((tokenId) => nftItem(tokenId)),
  nextCursor,
});
const advanceTime = (milliseconds: number) => act(async () => jest.advanceTimersByTimeAsync(milliseconds));
const collection = (contractAddress: string): INftCollection => ({
  id: contractAddress.toLowerCase(),
  networkId: 'network',
  contractAddress,
  type: ASSET_TYPE.ERC721,
  name: null,
  symbol: null,
  icon: null,
});
function useItems(addressId = 'addr_1', contractAddresses: readonly string[] = ['0xaaa'], enabled = true) {
  return useNftItems(useNftListState(addressId), contractAddresses, { enabled });
}

describe('NFT queries', () => {
  let queryClient: QueryClient;
  let wrapper: ComponentType<{ children: ReactNode }>;
  let service: { listCollections: jest.Mock; getItemsPage: jest.Mock };

  beforeEach(() => {
    AppState.currentState = 'active';
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      listCollections: jest.fn().mockResolvedValue([]),
      getItemsPage: jest.fn().mockResolvedValue(nftPage(['1'])),
    };
    (getNftService as jest.Mock).mockReturnValue(service);
  });

  afterEach(() => {
    queryClient.clear();
    AppState.currentState = originalAppState;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shares requests and next pages, including results completed after all consumers leave', async () => {
    let complete!: (page: INftItemsPage) => void;
    service.getItemsPage.mockReturnValue(
      new Promise<INftItemsPage>((resolve) => {
        complete = resolve;
      }),
    );
    const home = renderHook(() => useItems('addr_1', ['0xaaa', '0xAAA']), {
      wrapper,
    });
    const send = renderHook(() => useItems('addr_1', ['0xAAA']), { wrapper });
    act(() => {
      home.result.current.toggleCollection(collection('0xaaa'));
      send.result.current.toggleCollection(collection('0xAAA'));
    });
    await waitFor(() => expect(service.getItemsPage).toHaveBeenCalledTimes(1));

    home.unmount();
    send.unmount();
    const oldActions = home.result.current;
    await act(async () => complete(nftPage(['1'], 'page-2')));
    act(() => {
      oldActions.loadMore('0xaaa');
    });

    const reopened = renderHook(({ contracts }: { contracts: string[] }) => useItems('addr_1', contracts), { wrapper, initialProps: { contracts: ['0xaaa'] } });
    act(() => reopened.result.current.toggleCollection(collection('0xaaa')));
    expect(reopened.result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('1')]);
    const peer = renderHook(() => useItems(), { wrapper });
    act(() => peer.result.current.toggleCollection(collection('0xaaa')));
    service.getItemsPage.mockResolvedValueOnce(nftPage(['2']));
    act(() => {
      reopened.result.current.loadMore('0xaaa');
      peer.result.current.loadMore('0xaaa');
    });
    await waitFor(() => expect(reopened.result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('1'), nftItem('2')]));
    expect(peer.result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('1'), nftItem('2')]);
    const actions = reopened.result.current;
    act(() => reopened.result.current.toggleCollection(collection('0xaaa')));
    act(() => {
      actions.loadMore('0xaaa');
    });
    await waitFor(() => expect(reopened.result.current.queriesByContract.size).toBe(0));
    expect(peer.result.current.expandedCollectionIds.has('0xaaa')).toBe(true);
    expect(service.getItemsPage).toHaveBeenCalledTimes(2);
  });

  it('keeps late responses and actions tied to their original account', async () => {
    jest.useFakeTimers();
    for (const addressId of ['addr_1', 'addr_2']) {
      for (const contractAddress of ['0xaaa', '0xbbb']) {
        queryClient.setQueryData(getNftItemsKey(addressId, contractAddress), {
          pages: [nftPage([`${addressId}:${contractAddress}`], 'page-2')],
          pageParams: ['0'],
        });
      }
    }
    const { result, rerender } = renderHook(({ addressId, contracts }: { addressId: string; contracts: string[] }) => useItems(addressId, contracts), {
      wrapper,
      initialProps: { addressId: 'addr_1', contracts: ['0xaaa', '0xbbb'] },
    });
    act(() => {
      result.current.toggleCollection(collection('0xaaa'));
      result.current.toggleCollection(collection('0xbbb'));
    });
    expect(result.current.queriesByContract.get('0xaaa')?.data?.[0]?.tokenId).toBe('addr_1:0xaaa');
    const queries = result.current.queriesByContract;
    rerender({ addressId: 'addr_1', contracts: ['0xbbb', '0xaaa'] });
    expect(result.current.queriesByContract).toBe(queries);
    const oldActions = result.current;

    let complete!: (page: INftItemsPage) => void;
    service.getItemsPage.mockReturnValueOnce(
      new Promise<INftItemsPage>((resolve) => {
        complete = resolve;
      }),
    );
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = queryClient.invalidateQueries({ queryKey: getNftItemsKey('addr_1', '0xbbb') });
    });
    rerender({ addressId: 'addr_2', contracts: ['0xbbb'] });
    expect(result.current.queriesByContract.size).toBe(0);
    act(() => result.current.toggleCollection(collection('0xbbb')));
    await act(async () => {
      complete(nftPage(['late-addr_1']));
      await refreshing;
    });
    await advanceTime(0);
    expect(result.current.queriesByContract.get('0xbbb')?.data?.[0]?.tokenId).toBe('addr_2:0xbbb');
    expect(result.current.queriesByContract.has('0xaaa')).toBe(false);
    act(() => {
      oldActions.loadMore('0xbbb');
    });
    expect(service.getItemsPage).toHaveBeenCalledTimes(1);
    expect(service.getItemsPage).toHaveBeenCalledWith({ addressId: 'addr_1', contractAddress: '0xbbb', cursor: '0' });
    expect(queryClient.getQueryData<{ pages: INftItemsPage[] }>(getNftItemsKey('addr_1', '0xbbb'))?.pages[0]?.items).toEqual([nftItem('late-addr_1')]);
  });

  it('keeps items after a failed next page and recovers on refresh without fetching another collection', async () => {
    service.getItemsPage.mockImplementation(async ({ contractAddress }) => (contractAddress === '0xaaa' ? nftPage(['1'], 'page-2') : nftPage(['B'])));
    const { result } = renderHook(() => useItems('addr_1', ['0xaaa', '0xbbb']), {
      wrapper,
    });
    act(() => {
      result.current.toggleCollection(collection('0xaaa'));
      result.current.toggleCollection(collection('0xbbb'));
    });
    await waitFor(() => expect([...result.current.queriesByContract.values()].map((query) => query.data?.length)).toEqual([1, 1]));
    const peer = renderHook(() => useItems(), { wrapper });
    act(() => peer.result.current.toggleCollection(collection('0xaaa')));
    service.getItemsPage
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [nftItem('1', 'updated'), nftItem('2')], nextCursor: null });

    act(() => result.current.loadMore('0xaaa'));
    await waitFor(() => expect(result.current.queriesByContract.get('0xaaa')?.isError).toBe(true));
    peer.unmount();
    expect(result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('1')]);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: getNftItemsKey('addr_1', '0xaaa') });
    });
    await waitFor(() => expect(result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('1', 'updated'), nftItem('2')]));
    expect(result.current.queriesByContract.get('0xaaa')?.hasNextPage).toBe(false);
    expect(result.current.queriesByContract.get('0xbbb')?.data).toEqual([nftItem('B')]);
    expect(service.getItemsPage.mock.calls.filter(([params]) => params.contractAddress === '0xbbb')).toHaveLength(1);
    expect(service.getItemsPage.mock.calls.filter(([params]) => params.contractAddress === '0xaaa').map(([params]) => params.cursor)).toEqual([
      '0',
      'page-2',
      '0',
    ]);
  });

  it('refreshes with new cursors and replaces loaded pages only when the refresh completes', async () => {
    service.getItemsPage.mockResolvedValueOnce(nftPage(['1'], 'old-page')).mockResolvedValueOnce(nftPage(['2']));
    const { result } = renderHook(() => useItems(), { wrapper });
    act(() => result.current.toggleCollection(collection('0xaaa')));
    await waitFor(() => expect(result.current.queriesByContract.get('0xaaa')?.data).toHaveLength(1));
    act(() => {
      result.current.loadMore('0xaaa');
      result.current.loadMore('0xaaa');
    });
    await waitFor(() => expect(result.current.queriesByContract.get('0xaaa')?.data).toHaveLength(2));

    let finishNextPage!: (page: INftItemsPage) => void;
    const nextPage = new Promise<INftItemsPage>((resolve) => {
      finishNextPage = resolve;
    });
    service.getItemsPage.mockResolvedValueOnce(nftPage(['10'], 'new-page')).mockReturnValueOnce(nextPage);
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = queryClient.invalidateQueries({ queryKey: getNftItemsKey('addr_1', '0xaaa') });
    });

    await waitFor(() => expect(service.getItemsPage).toHaveBeenCalledTimes(4));
    expect(service.getItemsPage.mock.calls.map(([params]) => params.cursor)).toEqual(['0', 'old-page', '0', 'new-page']);
    act(() => result.current.loadMore('0xaaa'));
    expect(service.getItemsPage).toHaveBeenCalledTimes(4);
    expect(result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('1'), nftItem('2')]);
    await act(async () => {
      finishNextPage(nftPage(['11']));
      await refreshing;
    });
    await waitFor(() => expect(result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('10'), nftItem('11')]));
  });

  it('keeps failures idle during visibility changes and settles manual refreshes', async () => {
    jest.useFakeTimers();
    service.getItemsPage.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useItems('addr_1', ['0xaaa', '0xbbb']), { wrapper });
    act(() => {
      result.current.toggleCollection(collection('0xaaa'));
      result.current.toggleCollection(collection('0xbbb'));
      result.current.setVisibleContractAddresses(['0xaaa']);
    });
    await waitFor(() => expect([...result.current.queriesByContract.values()].map((query) => query.isError)).toEqual([true, true]));
    const failedQueries = result.current.queriesByContract;
    act(() => result.current.setVisibleContractAddresses(['0xbbb']));
    expect(result.current.queriesByContract).toBe(failedQueries);
    await advanceTime(29_000);
    expect(service.getItemsPage).toHaveBeenCalledTimes(2);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: getNftAddressKey('addr_1') });
    });
    expect(service.getItemsPage).toHaveBeenCalledTimes(4);
    expect([...result.current.queriesByContract.values()].every((query) => query.isError && !query.isFetching)).toBe(true);
  });

  it('polls only while active and visible, and cleans up across Strict Mode lifecycles', async () => {
    jest.useFakeTimers();
    const QueryWrapper = wrapper;
    const strictWrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <QueryWrapper>{children}</QueryWrapper>
      </StrictMode>
    );
    const listeners = new Set<() => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      const onChange = listener as () => void;
      listeners.add(onChange);
      return { remove: () => listeners.delete(onChange) };
    });
    const setAppState = (state: 'active' | 'background') =>
      act(() => {
        AppState.currentState = state;
        for (const listener of listeners) listener();
      });
    const { result, rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => ({
        collections: useNftCollectionsOfAddress('addr_1', { enabled }),
        items: useItems('addr_1', ['0xaaa'], enabled),
      }),
      { wrapper: strictWrapper, initialProps: { enabled: true } },
    );
    act(() => {
      result.current.items.toggleCollection(collection('0xaaa'));
      result.current.items.setVisibleContractAddresses(['0xaaa']);
    });
    await waitFor(() => expect(result.current.items.queriesByContract.get('0xaaa')?.data).toHaveLength(1));
    const itemCalls = service.getItemsPage.mock.calls.length;
    const collectionCalls = service.listCollections.mock.calls.length;

    await advanceTime(29_000);
    expect(service.getItemsPage).toHaveBeenCalledTimes(itemCalls);
    await advanceTime(1_000);
    expect(service.getItemsPage).toHaveBeenCalledTimes(itemCalls + 1);
    expect(service.listCollections).toHaveBeenCalledTimes(collectionCalls + 1);

    act(() => result.current.items.setVisibleContractAddresses([]));
    await advanceTime(30_000);
    expect(service.getItemsPage).toHaveBeenCalledTimes(itemCalls + 1);
    expect(service.listCollections).toHaveBeenCalledTimes(collectionCalls + 2);

    rerender({ enabled: false });
    act(() => {
      result.current.items.loadMore('0xaaa');
    });
    await advanceTime(60_000);
    expect(service.getItemsPage).toHaveBeenCalledTimes(itemCalls + 1);
    expect(service.listCollections).toHaveBeenCalledTimes(collectionCalls + 2);
    expect(result.current.items.queriesByContract.get('0xaaa')?.data).toHaveLength(1);

    act(() => result.current.items.setVisibleContractAddresses(['0xaaa']));
    rerender({ enabled: true });
    await waitFor(() => expect(service.getItemsPage).toHaveBeenCalledTimes(itemCalls + 2));
    setAppState('background');
    await advanceTime(60_000);
    expect(service.getItemsPage).toHaveBeenCalledTimes(itemCalls + 2);
    expect(service.listCollections).toHaveBeenCalledTimes(collectionCalls + 3);

    setAppState('active');
    await waitFor(() => expect(service.getItemsPage).toHaveBeenCalledTimes(itemCalls + 3));
    expect(service.listCollections).toHaveBeenCalledTimes(collectionCalls + 4);
    unmount();
    expect(listeners.size).toBe(0);
    await advanceTime(60_000);
    expect(service.getItemsPage).toHaveBeenCalledTimes(itemCalls + 3);
    expect(service.listCollections).toHaveBeenCalledTimes(collectionCalls + 4);
  });

  it('releases collapsed queries and starts fresh after their cache expires', async () => {
    jest.useFakeTimers();
    const key = getNftItemsKey('addr_1', '0xaaa');
    queryClient.setQueryDefaults(key, { gcTime: 1_000 });
    const { result } = renderHook(() => useItems(), { wrapper });
    act(() => result.current.toggleCollection(collection('0xaaa')));
    await waitFor(() => expect(result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('1')]));
    act(() => result.current.toggleCollection(collection('0xaaa')));
    await advanceTime(1_001);
    expect(queryClient.getQueryState(key)).toBeUndefined();

    service.getItemsPage.mockResolvedValueOnce(nftPage(['fresh']));
    act(() => result.current.toggleCollection(collection('0xaaa')));
    expect(result.current.queriesByContract.get('0xaaa')?.data).toBeUndefined();
    await waitFor(() => expect(result.current.queriesByContract.get('0xaaa')?.data).toEqual([nftItem('fresh')]));
    expect(service.getItemsPage).toHaveBeenCalledTimes(2);
  });
});
