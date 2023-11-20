import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap } from 'rxjs';
import { memoize } from 'lodash-es';
import { observeAccountById } from '../../../../database/models/Account/query';

export const observeGroupOfAccount = memoize((accountId: string) => observeAccountById(accountId).pipe(switchMap((account) => account.accountGroup.observe())));

const groupAtomFamilyOfAccount = atomFamily((accountId: string) => atomWithObservable(() => observeGroupOfAccount(accountId), { initialValue: null! }));

export const useGroupOfAccount = (accountId: string) => useAtomValue(groupAtomFamilyOfAccount(accountId));
