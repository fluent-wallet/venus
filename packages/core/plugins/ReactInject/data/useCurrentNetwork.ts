import { atom, useAtomValue } from 'jotai';
import { networksAtom } from './useNetworks';

export const currentNetworkAtom = atom((get) => get(networksAtom)?.find?.((network) => network.selected));
export const useCurrentNetwork = () => useAtomValue(currentNetworkAtom);
