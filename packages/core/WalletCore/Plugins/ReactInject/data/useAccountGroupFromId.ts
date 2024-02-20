import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { of } from 'rxjs';
import { observeAccountGroupById } from '../../../../database/models/AccountGroup/query';

const accountGroupAtomFromId = atomFamily((accountGroupId: string | undefined | null) =>
  atomWithObservable(() => (accountGroupId ? observeAccountGroupById(accountGroupId) : of(null)), { initialValue: null! }),
);

export const useAccountGroupFromId = (accountGroupId: string | undefined | null) => useAtomValue(accountGroupAtomFromId(accountGroupId));
