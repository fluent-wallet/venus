import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { type Observable } from 'rxjs';
import database from '../../../../database';
import TableName from '../../../../database/TableName';
import { type Network } from '../../../../database/models/Network';

export const networksObservable = database.collections.get(TableName.Network).query().observe() as Observable<Array<Network>>;

export const networksAtom = atomWithObservable(() => networksObservable, { initialValue: [] });
export const useNetworks = () => useAtomValue(networksAtom);
