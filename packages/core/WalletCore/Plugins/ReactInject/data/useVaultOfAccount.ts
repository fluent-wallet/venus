import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, of } from 'rxjs';
import { memoize } from 'lodash-es';
import { observeGroupOfAccount } from './useGroupOfAccount';

export const observeVaultOfAccount = memoize((accountId: string) =>
  observeGroupOfAccount(accountId).pipe(switchMap((accountGroup) => accountGroup.vault.observe())),
);

const vaultAtomFamilyOfAccount = atomFamily((accountId: string | undefined) =>
  atomWithObservable(() => (accountId ? observeVaultOfAccount(accountId) : of(null)), { initialValue: null! }),
);

export const useVaultOfAccount = (accountId: string | undefined) => useAtomValue(vaultAtomFamilyOfAccount(accountId));
