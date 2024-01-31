import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, startWith } from 'rxjs';
import { queryAllAddresses } from '../../../../database/models/Address/query';
import { dbRefresh$ } from '../../../../database';

export const addressesObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => queryAllAddresses().observe()),
);
const addressesAtom = atomWithObservable(() => addressesObservable, { initialValue: [] });

export const useAddresses = () => useAtomValue(addressesAtom);
