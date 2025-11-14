import { atom, useAtomValue } from 'jotai';
import { getAtom, setAtom } from '../nexus';
import { defaultWalletConfigs, type WalletConfig } from '../../WalletConfig/consts';

const walletConfigAtom = atom(defaultWalletConfigs);

export const useWalletConfig = () => useAtomValue(walletConfigAtom);
export const getWalletConfig = () => getAtom(walletConfigAtom) || defaultWalletConfigs;

export const updateAtomWalletConfig = (newConfig: WalletConfig) => {
  setAtom(walletConfigAtom, newConfig);
};
