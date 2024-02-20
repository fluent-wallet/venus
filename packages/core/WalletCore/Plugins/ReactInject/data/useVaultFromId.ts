import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { of } from 'rxjs';
import { observeVaultById } from '../../../../database/models/Vault/query';

const vaultAtomFromId = atomFamily((vaultId: string | undefined | null) =>
  atomWithObservable(() => (vaultId ? observeVaultById(vaultId) : of(null)), { initialValue: null! }),
);

export const useVaultFromId = (vaultId: string | undefined | null) => useAtomValue(vaultAtomFromId(vaultId));
