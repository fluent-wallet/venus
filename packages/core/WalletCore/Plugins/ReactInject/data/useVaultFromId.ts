import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { observeVaultById } from '../../../../database/models/Vault/query';

const vaultAtomFromId = atomFamily((vaultId: string) => atomWithObservable(() => observeVaultById(vaultId), { initialValue: null! }));

export const useVaultFromId = (vaultId: string) => useAtomValue(vaultAtomFromId(vaultId));
