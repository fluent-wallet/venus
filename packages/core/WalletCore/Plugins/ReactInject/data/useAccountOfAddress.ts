import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, of } from 'rxjs';
import { memoize } from 'lodash-es';
import { observeAddressById } from '../../../../database/models/Address/query';

export const observeAccountOfAddress = memoize((addressId: string) => observeAddressById(addressId).pipe(switchMap((address) => address.account.observe())));

const accountAtomFamilyOfAddress = atomFamily((addressId: string | undefined | null) =>
  atomWithObservable(() => (addressId ? observeAccountOfAddress(addressId) : of(null)), { initialValue: null! }),
);

export const useAccountOfAddress = (addressId: string | undefined | null) => useAtomValue(accountAtomFamilyOfAddress(addressId));
