import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, map, from, combineLatest, type Observable } from 'rxjs';
import { groupBy, flatMap, toPairs, sortBy } from 'lodash-es';
import database, { dbRefresh$ } from '../../../../database';
import TableName from '../../../../database/TableName';
import VaultType from '../../../../database/models/Vault/VaultType';
import { type Account } from '../../../../database/models/Account';
import { currentNetworkObservable } from './useCurrentNetwork';

export const accountsManageObservable = combineLatest([dbRefresh$.pipe(startWith(null)), currentNetworkObservable]).pipe(
  startWith(null),
  switchMap(() => database.collections.get(TableName.Account).query().observeWithColumns(['nickname', 'hidden']) as Observable<Array<Account>>),
  switchMap((accounts) =>
    from(
      Promise.all(
        accounts.map(async (account) => {
          const accountGroup = await account.accountGroup;
          return {
            account: {
              key: account.id,
              nickname: account.nickname,
              id: account.id,
              hidden: account.hidden,
              addressValue: await (await account.currentNetworkAddress).getValue(),
            },
            accountGroup,
            vault: await accountGroup.vault,
          };
        }),
      ),
    ),
  ),
  map((mergedAccountsData) => {
    // const grouped = groupBy(
    //   mergedAccountsData.filter((item) => !item.account.hidden),
    //   (account) => account.accountGroup.id,
    // );
    // const groupedArray = toPairs(grouped).map(([accountGroupId, accounts]) => ({
    //   key: accountGroupId,
    //   id: accountGroupId,
    //   nickname: accounts[0].accountGroup.nickname,
    //   vaultType: accounts[0].vault.type,
    //   accounts: accounts.map(({ account }) => account),
    // }));

    // const sortedGroupedArray = sortBy(groupedArray, (item) => item.vaultType !== VaultType.BSIM);

    // return flatMap(sortedGroupedArray, ({ id, nickname, vaultType, accounts }) => [{ id, nickname, vaultType }, ...accounts]);

    const grouped = groupBy(
      mergedAccountsData.filter((item) => !item.account.hidden),
      (account) => account.accountGroup.id,
    );
    const groupedArray = toPairs(grouped).map(([accountGroupId, accounts]) => ({
      title: {
        key: accountGroupId,
        id: accountGroupId,
        nickname: accounts[0].accountGroup.nickname,
        vaultType: accounts[0].vault.type,
      },
      data: accounts.map(({ account }) => account),
    }));

    const sortedGroupedArray = sortBy(groupedArray, (item) => item.title.vaultType !== VaultType.BSIM);
    return sortedGroupedArray;
  }),
);

const accountsManageAtom = atomWithObservable(() => accountsManageObservable, {
  initialValue: [],
});

export const useAccountsManage = () => useAtomValue(accountsManageAtom);
