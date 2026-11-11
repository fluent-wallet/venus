import type { InfiniteQueryObserverResult, QueryClient, QueryKey } from '@tanstack/react-query';
import { InfiniteQueryObserver } from '@tanstack/react-query';
import { atom, createStore } from 'jotai';
import { selectAtom } from 'jotai/utils';
import type { INftCollection, INftItem, INftItemsPage } from './core';

export type NftItemsQuery = Pick<
  InfiniteQueryObserverResult<INftItem[]>,
  'data' | 'isPending' | 'isFetching' | 'isFetchingNextPage' | 'hasNextPage' | 'isError'
>;
const itemQueryProps = ['data', 'isPending', 'isFetching', 'isFetchingNextPage', 'hasNextPage', 'isError'] as const;
type NftItemsObserver = InfiniteQueryObserver<INftItemsPage, Error, INftItem[], QueryKey, string>;
type NftItemsOptions = Parameters<NftItemsObserver['setOptions']>[0];
type NftListView = { enabled: boolean; contractAddresses: ReadonlySet<string>; visibleContractAddresses: ReadonlySet<string> };

export function createNftListState(addressId: string, client: QueryClient, getQueryOptions: (contractAddress: string) => NftItemsOptions) {
  const store = createStore();
  const viewAtom = atom<NftListView>({ enabled: false, contractAddresses: new Set<string>(), visibleContractAddresses: new Set<string>() });
  const expandedCollectionsAtom = atom(new Map<string, ReturnType<typeof createCollectionQuery>>());
  const expandedCollectionIdsAtom = atom((get) => new Set([...get(expandedCollectionsAtom).values()].map((query) => query.collectionId)));
  const itemsAtom = atom((get) => {
    const queries = new Map<string, NftItemsQuery>();
    for (const [contract, query] of get(expandedCollectionsAtom)) queries.set(contract, get(query.resultAtom));
    return queries;
  });

  function createCollectionQuery(collection: INftCollection) {
    const contractAddress = collection.contractAddress.toLowerCase();
    const activityAtom = selectAtom(
      viewAtom,
      (view) => ({ enabled: view.enabled && view.contractAddresses.has(contractAddress), visible: view.visibleContractAddresses.has(contractAddress) }),
      (previous, next) => previous.enabled === next.enabled && previous.visible === next.visible,
    );
    const queryOptions = getQueryOptions(contractAddress);
    const options = (): NftItemsOptions => {
      const activity = store.get(activityAtom);
      return {
        ...queryOptions,
        enabled: activity.enabled,
        refetchInterval: activity.visible ? queryOptions.refetchInterval : false,
        notifyOnChangeProps: [...itemQueryProps],
      };
    };
    const observer = new InfiniteQueryObserver(client, options());
    const resultAtom = atom(observer.getCurrentResult());

    resultAtom.onMount = (setResult) => {
      observer.setOptions(options());
      const unsubscribe = observer.subscribe(setResult);
      const stopActivity = store.sub(activityAtom, () => observer.setOptions(options()));
      setResult(observer.getCurrentResult());
      return () => {
        stopActivity();
        unsubscribe();
      };
    };

    return { collectionId: collection.id, observer, resultAtom };
  }

  return {
    addressId,
    store,
    itemsAtom,
    expandedCollectionIdsAtom,
    toggleCollection(collection: INftCollection) {
      const contractAddress = collection.contractAddress.toLowerCase();
      const expanded = new Map(store.get(expandedCollectionsAtom));
      if (!expanded.delete(contractAddress)) expanded.set(contractAddress, createCollectionQuery(collection));
      store.set(expandedCollectionsAtom, expanded);
    },
    setView({ enabled, contractAddresses }: { enabled: boolean; contractAddresses: readonly string[] }) {
      store.set(viewAtom, (view) => ({ ...view, enabled, contractAddresses: new Set(contractAddresses.map((contract) => contract.toLowerCase())) }));
    },
    setVisibleContractAddresses(contractAddresses: readonly string[]) {
      store.set(viewAtom, (view) => ({ ...view, visibleContractAddresses: new Set(contractAddresses.map((contract) => contract.toLowerCase())) }));
    },
    loadMore(contractAddress: string) {
      const observer = store.get(expandedCollectionsAtom).get(contractAddress.toLowerCase())?.observer;
      if (!observer?.hasListeners() || !observer.options.enabled) return;
      const query = observer.getCurrentResult();
      if (!query.hasNextPage || query.isFetching || query.isError) return;
      void observer.fetchNextPage({ cancelRefetch: false });
    },
  };
}

export type NftListState = ReturnType<typeof createNftListState>;
