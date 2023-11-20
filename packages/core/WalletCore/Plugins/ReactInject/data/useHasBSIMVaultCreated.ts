import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { observeBSIMCreated } from '../../../../database/models/Vault/query';

const hasBSIMVaultCreatedAtom = atomWithObservable(() => observeBSIMCreated(), { initialValue: false });
export const useHasBSIMVaultCreated = () => useAtomValue(hasBSIMVaultCreatedAtom);
