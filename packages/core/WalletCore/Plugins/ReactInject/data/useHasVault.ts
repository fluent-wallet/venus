import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { map } from 'rxjs';
import { vaultsObservable } from './useVaults';

const hasVaultAtom = atomWithObservable(() => vaultsObservable.pipe(map((vaults) => vaults?.length > 0)), {
  initialValue: undefined,
});

export const useHasVault = () => useAtomValue(hasVaultAtom);
