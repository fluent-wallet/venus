import { atom, useAtomValue } from 'jotai';
import { map } from 'rxjs';
import { setAtom } from '../nexus';
import { type Account } from '../../../database/models/Account';
import { querySelectedAccount } from '../../../database/models/Account/query';

const currentAccountAtom = atom(null as unknown as Account);
export const useCurrentAccount = () => useAtomValue(currentAccountAtom);

export const currentAccountObservable = querySelectedAccount()
  .observe()
  .pipe(map((accounts) => accounts?.[0]));

currentAccountObservable.subscribe((currentAccount) => {
  setAtom(currentAccountAtom, currentAccount);
});
