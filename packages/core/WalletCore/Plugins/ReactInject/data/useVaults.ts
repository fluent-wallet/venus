import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, type Observable } from 'rxjs';
import database, { dbRefresh$ } from '../../../../database';
import TableName from '../../../../database/TableName';
import { type Vault } from '../../../../database/models/Vault';

export const vaultsObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => database.collections.get(TableName.Vault).query().observe() as Observable<Array<Vault>>)
);

const vaultsAtom = atomWithObservable(() => vaultsObservable, {
  initialValue: [],
});

export const useVaults = () => useAtomValue(vaultsAtom);
