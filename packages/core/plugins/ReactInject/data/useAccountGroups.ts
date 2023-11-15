import { atom, useAtomValue } from 'jotai';
import { setAtom } from '../nexus';
import database from '../../../database';
import TableName from '../../../database/TableName';
import { type AccountGroup } from '../../../database/models/AccountGroup';

const accountGroupsAtom = atom<Array<AccountGroup>>([]);
export const useAccountGroups = () => useAtomValue(accountGroupsAtom);

export const accountGroupsObservable = database.collections.get(TableName.AccountGroup).query().observe();

accountGroupsObservable.subscribe((accountGroups) => {
  setAtom(accountGroupsAtom, (accountGroups || []) as Array<AccountGroup>);
});

