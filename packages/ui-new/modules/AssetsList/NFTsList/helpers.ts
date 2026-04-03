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
