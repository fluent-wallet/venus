import { atom, useAtomValue } from 'jotai';
import { setAtom } from '../nexus';
import database from '../../../database';
import TableName from '../../../database/TableName';
import { type Network } from '../../../database/models/Network';

export const networksAtom = atom<Array<Network>>([]);
export const useNetworks = () => useAtomValue(networksAtom);

export const networksObservable = database.collections.get(TableName.Network).query().observe();

networksObservable.subscribe((networks) => {
  setAtom(networksAtom, (networks || []) as Array<Network>);
});
