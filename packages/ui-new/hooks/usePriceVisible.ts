import { setAtom } from '@core/WalletCore/Plugins/ReactInject';
import database from '@core/database';
import { atom, useAtom, useAtomValue } from 'jotai';

const _TotalPriceVisibleAtom = atom<boolean | null>(true);
database.localStorage.get('totalPriceVisible').then((visible) => typeof visible === 'boolean' && setAtom(_TotalPriceVisibleAtom, visible));

const TotalPriceVisibleAtom = atom(
  (get) => {
    const totalPriceVisible = get(_TotalPriceVisibleAtom);
    return typeof totalPriceVisible === 'boolean' ? totalPriceVisible : true;
  },
  (_, set, update: boolean) => {
    database.localStorage.set('totalPriceVisible', update);
    set(_TotalPriceVisibleAtom, update);
  },
);

export const usePriceVisibleValue = () => useAtomValue(TotalPriceVisibleAtom);
export const usePriceVisible = () => useAtom(TotalPriceVisibleAtom);
