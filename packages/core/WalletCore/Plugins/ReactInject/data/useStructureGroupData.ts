import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { combineLatest, switchMap, map, iif, of } from 'rxjs';
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

const structureGroupDataObservable = accountGroupsObservable.pipe(
  switchMap((accountGroups) =>
    combineLatest(accountGroups.map((accountGroup) => accountGroup.accounts.observe())).pipe(
      map((accountsArr) => ({
        accountGroups,
        accountsArr,
      }))
    )
  ),
  switchMap(({ accountGroups, accountsArr }) =>
    combineLatest(
      accountsArr.flat().map((account) => account.currentNetworkAddress.pipe(switchMap((address) => iif(() => !!address, address?.getValue(), of(null)))))
    ).pipe(map((addressesArr) => ({ accountGroups, accountsArr, addressesArr })))
  ),
  map(({ accountGroups, accountsArr, addressesArr }) => {
    const structureGroupData: Array<StructureGroupData> = [];
    let addressIndex = 0;
    accountGroups.forEach((accountGroup, index) => {
      structureGroupData.push({
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
    return structureGroupData;
  })
);

const structureGroupDataAtom = atomWithObservable(() => structureGroupDataObservable, {
  initialValue: [],
});
export const useStructureGroupData = () => useAtomValue(structureGroupDataAtom);
