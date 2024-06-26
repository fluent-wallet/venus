import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { map, startWith, switchMap } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { querySelectedAccount } from '../../../../database/models/Account/query';

export const currentAccountObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => querySelectedAccount().observeWithColumns(['nickname', 'selected', 'hidden'])),
  map((selectedAccounts) => selectedAccounts?.[0] ?? null),
);

const currentAccountAtom = atomWithObservable(() => currentAccountObservable, { initialValue: null });
export const useCurrentAccount = () => useAtomValue(currentAccountAtom);
