import type { INftCollection, INftItem } from '@service/core';
import type { AssetInfo } from '@utils/assetInfo';

export function toNftAssetInfo(params: {
  collection: Pick<INftCollection, 'contractAddress' | 'type' | 'name' | 'symbol' | 'icon'>;
  item: INftItem;
}): AssetInfo {
  return {
    type: params.collection.type,
    contractAddress: params.collection.contractAddress,
    name: params.collection.name ?? '',
    symbol: params.collection.symbol ?? '',
    decimals: 0,
    balance: params.item.amount,
    icon: params.collection.icon ?? undefined,
  };
}

export function shouldShowNftCollectionsSkeleton({
  addressId,
  collectionsCount,
  collectionsStatus,
  currentAddressStatus,
}: {
  addressId: string;
  collectionsCount: number;
  collectionsStatus: string;
  currentAddressStatus: string;
}): boolean {
  return collectionsCount === 0 && (currentAddressStatus === 'pending' || (Boolean(addressId) && collectionsStatus === 'pending'));
}
