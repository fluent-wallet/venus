import { atom, useAtomValue } from 'jotai';
import { setAtom } from '@core/WalletCore/Plugins/ReactInject';

type Mode = 'light' | 'dark' | 'system';
const modeAtom = atom<Mode>('system');
export const useMode = () => useAtomValue(modeAtom);
export const setMode = (mode: Mode) => setAtom(modeAtom, mode);
