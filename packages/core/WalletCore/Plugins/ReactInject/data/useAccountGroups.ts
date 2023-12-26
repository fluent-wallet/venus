import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, map, from, type Observable } from 'rxjs';
import database, { dbRefresh$ } from '../../../../database';
import TableName from '../../../../database/TableName';
import VaultType from '../../../../database/models/Vault/VaultType';
import { type AccountGroup } from '../../../../database/models/AccountGroup';

export const accountGroupsObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => database.collections.get(TableName.AccountGroup).query().observeWithColumns(['nickname', 'hidden']) as Observable<Array<AccountGroup>>),
  switchMap((accountGroups) =>
    from(
      Promise.all(
        accountGroups.map(async (accountGroup) => ({
          accountGroup,
          vault: await accountGroup.vault,
        }))
      )
    )
  ),
  map((mergeGroupsData) => {
    const BSIMGroupIndex = mergeGroupsData.findIndex(({ vault }) => vault.type === VaultType.BSIM);
    const accountGroups = mergeGroupsData.map(({ accountGroup }) => accountGroup);
    if (BSIMGroupIndex > -1) {
      const [BSIMGroup] = accountGroups.splice(BSIMGroupIndex, 1);
      return [BSIMGroup, ...accountGroups];
    }
    return accountGroups;
  })
);

const accountGroupsAtom = atomWithObservable(() => accountGroupsObservable, {
  initialValue: [],
});

export const useAccountGroups = () => useAtomValue(accountGroupsAtom);
