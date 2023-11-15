import { atom, useAtomValue } from 'jotai';
import { switchMap } from 'rxjs';
import { setAtom } from '../nexus';
import { type Address } from '../../../database/models/Address';
import { currentAccountObservable } from './useCurrentAccount';

export const currentNetworkAddressAtom = atom(null as unknown as Address);
export const useCurrentNetworkAddress = () => useAtomValue(currentNetworkAddressAtom);

const currentNetworkAddressObservable = currentAccountObservable.pipe(switchMap((account) => account?.currentNetworkAddress));

currentNetworkAddressObservable.subscribe((currentNetworkAddress) => {
  setAtom(currentNetworkAddressAtom, currentNetworkAddress);
});
