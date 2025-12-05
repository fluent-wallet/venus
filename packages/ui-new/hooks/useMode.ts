import database from '@core/database';
import { setAtom } from '@core/WalletCore/Plugins/ReactInject';
import { atom, useAtomValue } from 'jotai';

type Mode = 'light' | 'dark' | 'system';
const _modeAtom = atom<Mode>('system');
database.localStorage.get('mode').then((mode) => (['light', 'dark', 'system'] as const).includes(mode as Mode) && setAtom(_modeAtom, mode as Mode));

const modeAtom = atom(
  (get) => {
    const mode = get(_modeAtom);
    return mode || 'system';
  },
  (_, set, update: Mode) => {
    database.localStorage.set('mode', update);
    set(_modeAtom, update);
  },
);

export const useMode = () => useAtomValue(modeAtom);
export const setMode = (mode: Mode) => setAtom(modeAtom, mode);
