import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, from, of } from 'rxjs';
import { memoize } from 'lodash-es';
import { observeAccountById } from '../../../../database/models/Account/query';

const addressesAtomFamilyOfAccount = atomFamily((accountId: string) =>
  atomWithObservable(() => observeAccountById(accountId).pipe(switchMap((account) => account.addresses.observe())), { initialValue: [] })
);
export const useAddressesOfAccount = (accountId: string) => useAtomValue(addressesAtomFamilyOfAccount(accountId));

const observeCurrentAddressOfAccount = memoize((accountId: string) =>
  observeAccountById(accountId).pipe(switchMap((account) => account.currentNetworkAddressObservable))
);
const currentAddressAtomFamilyOfAccount = atomFamily((accountId: string | undefined) =>
  atomWithObservable(() => (accountId ? observeCurrentAddressOfAccount(accountId) : of(null)), { initialValue: null! })
);
const currentAddressValueAtomFamilyOfAccount = atomFamily((accountId: string | undefined) =>
  atomWithObservable(
    () =>
      accountId
        ? observeCurrentAddressOfAccount(accountId).pipe(switchMap((address) => (address ? from(address.getValue()) : of(null as unknown as string))))
        : of(null),
    {
      initialValue: null!,
    }
  )
);
export const useCurrentAddressOfAccount = (accountId: string | undefined) => useAtomValue(currentAddressAtomFamilyOfAccount(accountId));
export const useCurrentAddressValueOfAccount = (accountId: string | undefined) => useAtomValue(currentAddressValueAtomFamilyOfAccount(accountId));
