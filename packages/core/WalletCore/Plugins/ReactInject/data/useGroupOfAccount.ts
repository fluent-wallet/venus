import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { memoize } from 'lodash-es';
import { of, switchMap } from 'rxjs';
import { observeAccountById } from '../../../../database/models/Account/query';

export const observeGroupOfAccount = memoize((accountId: string) => observeAccountById(accountId).pipe(switchMap((account) => account.accountGroup.observe())));

const groupAtomFamilyOfAccount = atomFamily((accountId: string | undefined | null) =>
  atomWithObservable(() => (accountId ? observeGroupOfAccount(accountId) : of(null)), { initialValue: null! }),
);

export const useGroupOfAccount = (accountId: string | undefined | null) => useAtomValue(groupAtomFamilyOfAccount(accountId));
