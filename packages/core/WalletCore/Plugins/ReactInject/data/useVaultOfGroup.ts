import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { memoize } from 'lodash-es';
import { of, switchMap } from 'rxjs';
import { observeAccountGroupById } from '../../../../database/models/AccountGroup/query';

export const observeVaultOfGroup = memoize((accountGroupId: string) =>
  observeAccountGroupById(accountGroupId).pipe(switchMap((accountGroup) => accountGroup.vault.observe())),
);

const vaultAtomFamilyOfGroup = atomFamily((accountGroupId: string | undefined | null) =>
  atomWithObservable(() => (accountGroupId ? observeVaultOfGroup(accountGroupId) : of(null)), { initialValue: null! }),
);

export const useVaultOfGroup = (accountGroupId: string | undefined | null) => useAtomValue(vaultAtomFamilyOfGroup(accountGroupId));
