import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { map } from 'rxjs';
import { type Account } from '../../../../database/models/Account';
import { querySelectedAccount } from '../../../../database/models/Account/query';

export const currentAccountObservable = querySelectedAccount()
  .observe()
  .pipe(map((accounts) => (accounts?.[0] as Account | undefined) ?? null));

const currentAccountAtom = atomWithObservable(() => currentAccountObservable, { initialValue: null });
export const useCurrentAccount = () => useAtomValue(currentAccountAtom);
