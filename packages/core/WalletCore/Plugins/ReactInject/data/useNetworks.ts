import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { type Observable, startWith, switchMap } from 'rxjs';
import database, { dbRefresh$ } from '../../../../database';
import type { Network } from '../../../../database/models/Network';
import TableName from '../../../../database/TableName';

export const networksObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => database.collections.get(TableName.Network).query().observe() as Observable<Array<Network>>),
);

export const networksAtom = atomWithObservable(() => networksObservable, { initialValue: [] });
export const useNetworks = () => useAtomValue(networksAtom);
