import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { of } from 'rxjs';
import { observeAccountById } from '../../../../database/models/Account/query';

const accountAtomFromId = atomFamily((accountId: string | undefined | null) =>
  atomWithObservable(() => (accountId ? observeAccountById(accountId) : of(null)), { initialValue: null! }),
);

export const useAccountFromId = (accountId: string | undefined | null) => useAtomValue(accountAtomFromId(accountId));
