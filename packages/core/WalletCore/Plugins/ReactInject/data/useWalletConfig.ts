import { atomWithObservable } from 'jotai/utils';
import { useAtomValue } from 'jotai';
import { getAtom } from '../nexus';
import { defaultWalletConfigs } from '../../WalletConfig/consts';
import { walletConfigSubject } from '@core/WalletCore/Events/walletConfigSubject';

const walletConfigAtom = atomWithObservable(() => walletConfigSubject, { initialValue: defaultWalletConfigs });

export const useWalletConfig = () => useAtomValue(walletConfigAtom);
export const getWalletConfig = () => getAtom(walletConfigAtom) || defaultWalletConfigs;
