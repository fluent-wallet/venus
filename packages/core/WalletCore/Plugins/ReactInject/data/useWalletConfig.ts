import { atom, useAtomValue } from 'jotai';
import { defaultWalletConfigs, type WalletConfig } from '../../WalletConfig/consts';
import { getAtom, setAtom } from '../nexus';

const walletConfigAtom = atom(defaultWalletConfigs);

export const useWalletConfig = () => useAtomValue(walletConfigAtom);
export const getWalletConfig = () => getAtom(walletConfigAtom) || defaultWalletConfigs;

export const updateAtomWalletConfig = (newConfig: WalletConfig) => {
  setAtom(walletConfigAtom, newConfig);
};
