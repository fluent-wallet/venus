import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { observeAccountGroupById } from '../../../../database/models/AccountGroup/query';

const accountGroupAtomFromId = atomFamily((accountGroupId: string) =>
  atomWithObservable(() => observeAccountGroupById(accountGroupId), { initialValue: null! })
);

export const useAccountGroupFromId = (accountGroupId: string) => useAtomValue(accountGroupAtomFromId(accountGroupId));
