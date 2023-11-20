import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap } from 'rxjs';
import { observeAccountGroupById } from '../../../../database/models/AccountGroup/query';

const accountsAtomFamilyOfGroup = atomFamily((accountGroupId: string) =>
  atomWithObservable(() => observeAccountGroupById(accountGroupId).pipe(switchMap((accountGroup) => accountGroup.accounts.observe())), { initialValue: [] })
);
export const useAccountsOfGroup = (accountGroupId: string) => useAtomValue(accountsAtomFamilyOfGroup(accountGroupId));
