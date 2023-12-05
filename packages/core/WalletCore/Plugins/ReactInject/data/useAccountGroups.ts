import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, type Observable } from 'rxjs';
import database, { dbRefresh$ } from '../../../../database';
import TableName from '../../../../database/TableName';
import { type AccountGroup } from '../../../../database/models/AccountGroup';

export const accountGroupsObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => database.collections.get(TableName.AccountGroup).query().observeWithColumns(['nickname', 'hidden']) as Observable<Array<AccountGroup>>)
);

const accountGroupsAtom = atomWithObservable(() => accountGroupsObservable, {
  initialValue: [],
});

export const useAccountGroups = () => useAtomValue(accountGroupsAtom);
