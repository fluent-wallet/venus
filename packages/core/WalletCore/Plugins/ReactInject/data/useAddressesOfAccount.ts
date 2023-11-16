import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap } from 'rxjs';
import { observeAccountById } from '../../../database/models/Account/query';

const addressesAtomFamilyOfAccount = atomFamily((accountId: string) =>
  atomWithObservable(() => observeAccountById(accountId).pipe(switchMap((account) => account.addresses.observe())), { initialValue: [] })
);
export const useAddressesOfAccount = (accountId: string) => useAtomValue(addressesAtomFamilyOfAccount(accountId));

const currentAddressAtomFamilyOfAccount = atomFamily((accountId: string) =>
  atomWithObservable(() => observeAccountById(accountId).pipe(switchMap((account) => account.currentNetworkAddress)), { initialValue: null! })
);
export const useCurrentAddressOfAccount = (accountId: string) => useAtomValue(currentAddressAtomFamilyOfAccount(accountId));
