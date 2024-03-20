import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, of } from 'rxjs';
import { observeAccountGroupById } from '../../../../database/models/AccountGroup/query';

const accountsAtomFamilyOfGroup = atomFamily((accountGroupId: string | undefined | null) =>
  atomWithObservable(
    () =>
      !accountGroupId
        ? of([])
        : observeAccountGroupById(accountGroupId).pipe(
            switchMap((accountGroup) => accountGroup.accounts.observeWithColumns(['nickname', 'selected', 'hidden'])),
          ),
    {
      initialValue: [],
    },
  ),
);

export const useAccountsOfGroup = (accountGroupId: string | undefined | null) => useAtomValue(accountsAtomFamilyOfGroup(accountGroupId));
