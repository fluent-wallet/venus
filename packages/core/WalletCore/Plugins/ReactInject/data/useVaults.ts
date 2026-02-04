import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { type Observable, startWith, switchMap } from 'rxjs';
import database, { dbRefresh$ } from '../../../../database';
import type { Vault } from '../../../../database/models/Vault';
import TableName from '../../../../database/TableName';

export const vaultsObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => database.collections.get(TableName.Vault).query().observe() as Observable<Array<Vault>>),
);

const vaultsAtom = atomWithObservable(() => vaultsObservable, {
  initialValue: [],
});

export const useVaults = () => useAtomValue(vaultsAtom);
