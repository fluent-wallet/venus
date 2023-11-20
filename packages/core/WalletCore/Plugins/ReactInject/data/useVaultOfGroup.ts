import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap } from 'rxjs';
import { memoize } from 'lodash-es';
import { observeAccountGroupById } from '../../../../database/models/AccountGroup/query';

export const observeVaultOfGroup = memoize((accountGroupId: string) =>
  observeAccountGroupById(accountGroupId).pipe(switchMap((accountGroup) => accountGroup.vault.observe()))
);

const vaultAtomFamilyOfGroup = atomFamily((accountGroupId: string) => atomWithObservable(() => observeVaultOfGroup(accountGroupId), { initialValue: null! }));

export const useVaultOfGroup = (accountGroupId: string) => useAtomValue(vaultAtomFamilyOfGroup(accountGroupId));
