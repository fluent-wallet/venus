import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useCurrentAddress } from './account';
import { getNftService, type INftCollection, type INftItem } from './core';

export type NftCollectionsQuery = UseQueryResult<INftCollection[]>;
export type NftItemsQuery = UseQueryResult<INftItem[]>;

export const getNftRootKey = () => ['nft'] as const;
export const getNftCollectionsByAddressKey = (addressId: string) => ['nft', 'collections', addressId] as const;
export const getNftItemsKey = (addressId: string, contractAddress: string) => ['nft', 'items', addressId, contractAddress.toLowerCase()] as const;

export function useNftCollectionsOfAddress(addressId: string, options: { enabled?: boolean } = {}): NftCollectionsQuery {
  const service = getNftService();
  const enabled = (options.enabled ?? true) && !!addressId;
  return useQuery({
    queryKey: getNftCollectionsByAddressKey(addressId || 'none'),
    queryFn: () => (addressId ? service.listCollections({ addressId }) : []),
    enabled,
    initialData: [],
  });
}

export function useNftCollectionsOfCurrentAddress(): NftCollectionsQuery {
  const currentAddress = useCurrentAddress();
  const addressId = currentAddress.data?.id ?? '';
  return useNftCollectionsOfAddress(addressId);
}

export function useNftItems(params: { addressId: string; contractAddress: string; enabled?: boolean }): NftItemsQuery {
  const service = getNftService();
  const enabled = params.enabled ?? true;
  const addressId = params.addressId ?? '';
  const contractAddress = params.contractAddress ?? '';

  return useQuery({
    queryKey: getNftItemsKey(addressId || 'none', contractAddress || 'none'),
    queryFn: () => (addressId && contractAddress ? service.getItems({ addressId, contractAddress }) : []),
    enabled: enabled && !!addressId && !!contractAddress,
    initialData: [],
  });
}
