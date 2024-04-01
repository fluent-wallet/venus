import { atom, useAtom, useAtomValue } from 'jotai';
import database from '@core/database';
import { setAtom } from '@core/WalletCore/Plugins/ReactInject';

const _TotalPriceVisibleAtom = atom<boolean | null>(null);
database.localStorage.get('totalPriceVisible').then((visible) => typeof visible === 'boolean' && setAtom(_TotalPriceVisibleAtom, visible));

const TotalPriceVisibleAtom = atom(
  (get) => {
    const totalPriceVisible = get(_TotalPriceVisibleAtom);
    return totalPriceVisible || false;
  },
  (_, set, update: boolean) => {
    database.localStorage.set('totalPriceVisible', update);
    set(_TotalPriceVisibleAtom, update);
  },
);

export const usePriceVisibleValue = () => useAtomValue(TotalPriceVisibleAtom);
export const usePriceVisible = () => useAtom(TotalPriceVisibleAtom);
