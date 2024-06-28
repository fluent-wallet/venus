import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { of, switchMap } from 'rxjs';
import { observeNetworkById } from '../../../../database/models/Network/query';

const addressesAtomFamilyOfNetwork = atomFamily((networkId: string | undefined | null) =>
  atomWithObservable(() => (!networkId ? of([]) : observeNetworkById(networkId).pipe(switchMap((network) => network.addresses.observe()))), {
    initialValue: [],
  }),
);

export const useAddressesOfNetwork = (networkId: string | undefined | null) => useAtomValue(addressesAtomFamilyOfNetwork(networkId));
