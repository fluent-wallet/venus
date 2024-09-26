import { atom, useAtomValue } from 'jotai';
import { getAtom, setAtom } from '../nexus';
import { defaultWalletConfigs } from '../../WalletConfig/consts';
import { walletConfigSubject } from '@core/WalletCore/Events/walletConfigSubject';

const walletConfigAtom = atom(defaultWalletConfigs);
walletConfigSubject.subscribe((config) => {
  setAtom(walletConfigAtom, config);
});

export const useWalletConfig = () => useAtomValue(walletConfigAtom);
export const getWalletConfig = () => getAtom(walletConfigAtom) || defaultWalletConfigs;
