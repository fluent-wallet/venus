import { atom } from 'jotai';
import database from '@core/database';
import { setAtom } from '@core/WalletCore/Plugins/ReactInject';

const _TotalPriceVisibleAtom = atom<boolean | null>(null);

const TotalPriceVisibleAtom = atom(
  (get) => {
    const totalPriceVisible = get(_TotalPriceVisibleAtom);
    if (totalPriceVisible === null) {
      database.localStorage.get('totalPriceVisible').then((visible) => typeof visible === 'boolean' && setAtom(_TotalPriceVisibleAtom, visible));
    }
    return totalPriceVisible;
  },
  (_, set, update: boolean) => {
    database.localStorage.set('totalPriceVisible', update);
    set(_TotalPriceVisibleAtom, update);
  }
);

export default TotalPriceVisibleAtom;
