import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, type Observable } from 'rxjs';
import database, { dbRefresh$ } from '../../../../database';
import TableName from '../../../../database/TableName';
import { type Network } from '../../../../database/models/Network';

export const networksObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => database.collections.get(TableName.Network).query().observe() as Observable<Array<Network>>)
);

export const networksAtom = atomWithObservable(() => networksObservable, { initialValue: [] });
export const useNetworks = () => useAtomValue(networksAtom);
