import { atom, useAtomValue } from 'jotai';
import { switchMap, zip, map } from 'rxjs';
import { setAtom } from '../nexus';
import { type AccountGroup } from '../../../database/models/AccountGroup';
import { accountGroupsObservable } from './useAccountGroups';

interface StructureGroupData {
  id: string;
  nickname: string;
  hidden: boolean;
  accounts: Array<{
    id: string;
    index: number;
    nickname: string;
    hidden: boolean;
    selected: boolean;
    createdAt: Date;
    currentNetworkAddressValue: string;
  }>;
}

const structureGroupDataAtom = atom<Array<StructureGroupData>>([]);
export const useStructureGroupData = () => useAtomValue(structureGroupDataAtom);

const structureGroupDataObservable = accountGroupsObservable.pipe(
  switchMap((accountGroups) =>
    Promise.all(accountGroups.map((accountGroup) => (accountGroup as AccountGroup).accounts.observe())).then((accountsObsArr) => ({
      accountGroups: accountGroups as Array<AccountGroup>,
      accountsObsArr: zip(...accountsObsArr),
    }))
  ),
  switchMap(({ accountGroups, accountsObsArr }) =>
    accountsObsArr.pipe(
      switchMap((accountsArr) =>
        Promise.all(accountsArr.flat().map((account) => account.currentNetworkAddress.pipe(switchMap((address) => address.getValue())))).then(
          (addressObsArr) => {
            return {
              accountGroups,
              accountsArr,
              addressesObsArr: zip(...addressObsArr),
            };
          }
        )
      )
    )
  ),
  switchMap(({ accountGroups, accountsArr, addressesObsArr }) =>
    addressesObsArr.pipe(
      map((addressesArr) => {
        const accountGroupWithAccounts: Array<StructureGroupData> = [];
        let addressIndex = 0;
        accountGroups.forEach((accountGroup, index) => {
          accountGroupWithAccounts.push({
            id: accountGroup.id,
            nickname: accountGroup.nickname,
            hidden: accountGroup.hidden,
            accounts: accountsArr[index].map((account) => ({
              id: account.id,
              index: account.index,
              nickname: account.nickname,
              hidden: account.hidden,
              selected: account.selected,
              createdAt: account.createdAt,
              currentNetworkAddressValue: addressesArr[addressIndex++],
            })),
          } as StructureGroupData);
        });
        return accountGroupWithAccounts;
      })
    )
  )
);

structureGroupDataObservable.subscribe((accountGroupWithAccounts) => {
  setAtom(structureGroupDataAtom, (accountGroupWithAccounts || []) as Array<StructureGroupData>);
});
