import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { observeAccountById } from '../../../../database/models/Account/query';

const accountAtomFromId = atomFamily((accountId: string) => atomWithObservable(() => observeAccountById(accountId), { initialValue: null! }));

export const useAccountFromId = (accountId: string) => useAtomValue(accountAtomFromId(accountId));
