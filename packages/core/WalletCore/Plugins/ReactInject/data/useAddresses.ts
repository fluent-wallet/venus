import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { startWith, switchMap } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { queryAllAddresses } from '../../../../database/models/Address/query';

export const addressesObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => queryAllAddresses().observe()),
);
const addressesAtom = atomWithObservable(() => addressesObservable, { initialValue: [] });

export const useAddresses = () => useAtomValue(addressesAtom);
