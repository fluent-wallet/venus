import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { type Observable } from 'rxjs';
import database from '../../../database';
import TableName from '../../../database/TableName';
import { type AccountGroup } from '../../../database/models/AccountGroup';

export const accountGroupsObservable = database.collections.get(TableName.AccountGroup).query().observe() as Observable<Array<AccountGroup>>;

const accountGroupsAtom = atomWithObservable(() => accountGroupsObservable, {
  initialValue: [],
});

export const useAccountGroups = () => useAtomValue(accountGroupsAtom);
