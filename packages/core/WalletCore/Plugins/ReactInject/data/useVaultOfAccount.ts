import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { memoize } from 'lodash-es';
import { of, switchMap } from 'rxjs';
import { observeGroupOfAccount } from './useGroupOfAccount';

export const observeVaultOfAccount = memoize((accountId: string) =>
  observeGroupOfAccount(accountId).pipe(switchMap((accountGroup) => accountGroup.vault.observe())),
);

const vaultAtomFamilyOfAccount = atomFamily((accountId: string | undefined | null) =>
  atomWithObservable(() => (accountId ? observeVaultOfAccount(accountId) : of(null)), { initialValue: null! }),
);

export const useVaultOfAccount = (accountId: string | undefined | null) => useAtomValue(vaultAtomFamilyOfAccount(accountId));
