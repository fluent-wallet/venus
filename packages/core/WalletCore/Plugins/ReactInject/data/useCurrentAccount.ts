import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { map, switchMap, startWith } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { querySelectedAccount } from '../../../../database/models/Account/query';

export const currentAccountObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => querySelectedAccount().observe()),
  map((selectedAccounts) => selectedAccounts?.[0] ?? null)
);

const currentAccountAtom = atomWithObservable(() => currentAccountObservable, { initialValue: null });
export const useCurrentAccount = () => useAtomValue(currentAccountAtom);
