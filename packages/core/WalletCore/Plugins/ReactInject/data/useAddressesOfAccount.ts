import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { memoize } from 'lodash-es';
import { from, of, switchMap } from 'rxjs';
import { observeAccountById } from '../../../../database/models/Account/query';

const addressesAtomFamilyOfAccount = atomFamily((accountId: string | null | undefined) =>
  atomWithObservable(() => (!accountId ? of(null) : observeAccountById(accountId).pipe(switchMap((account) => account.addresses.observe()))), {
    initialValue: [],
  }),
);
export const useAddressesOfAccount = (accountId: string | null | undefined) => useAtomValue(addressesAtomFamilyOfAccount(accountId));

const observeCurrentAddressOfAccount = memoize((accountId: string) =>
  observeAccountById(accountId).pipe(switchMap((account) => account.currentNetworkAddressObservable)),
);
const currentAddressAtomFamilyOfAccount = atomFamily((accountId: string | undefined | null) =>
  atomWithObservable(() => (accountId ? observeCurrentAddressOfAccount(accountId) : of(null)), { initialValue: null! }),
);
const currentAddressValueAtomFamilyOfAccount = atomFamily((accountId: string | undefined | null) =>
  atomWithObservable(
    () =>
      accountId
        ? observeCurrentAddressOfAccount(accountId).pipe(switchMap((address) => (address ? from(address.getValue()) : of(null as unknown as string))))
        : of(null),
    {
      initialValue: null!,
    },
  ),
);
export const useCurrentAddressOfAccount = (accountId: string | undefined | null) => useAtomValue(currentAddressAtomFamilyOfAccount(accountId));
export const useCurrentAddressValueOfAccount = (accountId: string | undefined | null) => useAtomValue(currentAddressValueAtomFamilyOfAccount(accountId));
