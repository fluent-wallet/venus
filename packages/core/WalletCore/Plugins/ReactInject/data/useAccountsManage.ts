import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, map, combineLatest, withLatestFrom, from, type Observable } from 'rxjs';
import { groupBy, toPairs, sortBy } from 'lodash-es';
import database, { dbRefresh$ } from '../../../../database';
import TableName from '../../../../database/TableName';
import VaultType from '../../../../database/models/Vault/VaultType';
import { type Account } from '../../../../database/models/Account';
import { currentNetworkObservable } from './useCurrentNetwork';
import { accountGroupsObservable } from './useAccountGroups';
import { zeroAddress } from '../../../../utils/address';

export const accountsManageObservable = combineLatest([dbRefresh$.pipe(startWith(null)), currentNetworkObservable, accountGroupsObservable]).pipe(
  switchMap(() => database.collections.get(TableName.Account).query().observeWithColumns(['nickname', 'hidden']) as Observable<Array<Account>>),
  withLatestFrom(currentNetworkObservable),
  withLatestFrom(accountGroupsObservable),
  switchMap(([[accounts, currentNetwork], accountGroups]) => {
    if (!currentNetwork) return [];
    return from(
      Promise.all(
        accounts.map(async (account) => {
          const _accountGroup = await account.accountGroup;
          const accountGroup = accountGroups.find((group) => group.id === _accountGroup.id)! || _accountGroup;
          const addresses = await account.addresses;
          const networks = await Promise.all(addresses.map((address) => address.network));
          const currentNetworkAddress = addresses.find((_, index) => networks[index].id === currentNetwork.id);
          return {
            account: {
              key: account.id,
              nickname: account.nickname,
              id: account.id,
              hidden: account.hidden,
              addressValue: currentNetworkAddress ? await currentNetworkAddress.getValue() : zeroAddress,
            },
            accountGroup,
            vault: await _accountGroup.vault,
          };
        }),
      ),
    );
  }),
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
        accountCount: accounts.length,
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
