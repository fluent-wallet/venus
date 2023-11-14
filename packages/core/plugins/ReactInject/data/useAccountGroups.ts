import { atom, useAtomValue } from 'jotai';
import database from '../../../database';
import TableName from '../../../database/TableName';
import { type AccountGroup } from '../../../database/models/AccountGroup';

const accountGroupsAtom = atom<Array<AccountGroup>>([]);

database.withChangesForTables([TableName.AccountGroup]).subscribe((changes) => {
  console.log('AccountGroup changes', changes);
});


export const useAccountGroups = () => useAtomValue(accountGroupsAtom);