import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, of, startWith } from 'rxjs';
import { dbRefresh$ } from '../../../../database'
import { querySelectedAccount } from '../../../../database/models/Account/query';

export const currentAccountObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => querySelectedAccount().observe()),
  switchMap((selectedAccounts) => {
    return selectedAccounts?.[0] ? of(selectedAccounts[0]) : of(null);
  })
);

const currentAccountAtom = atomWithObservable(() => currentAccountObservable, { initialValue: null });
export const useCurrentAccount = () => useAtomValue(currentAccountAtom);
