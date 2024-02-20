import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { of } from 'rxjs';
import { observeAccountGroupById } from '../../../../database/models/AccountGroup/query';

const groupAtomFromId = atomFamily((groupId: string | undefined | null) =>
  atomWithObservable(() => (groupId ? observeAccountGroupById(groupId) : of(null)), { initialValue: null! }),
);

export const useGroupFromId = (groupId: string | undefined | null) => useAtomValue(groupAtomFromId(groupId));
