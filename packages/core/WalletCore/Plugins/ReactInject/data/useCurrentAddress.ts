import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, iif, of } from 'rxjs';
import { currentAccountObservable } from './useCurrentAccount';

const currentAddressObservable = currentAccountObservable.pipe(
  switchMap((account) => iif(() => account && account.currentNetworkAddress !== null, account?.currentNetworkAddress, of(null)))
);

export const currentAddressAtom = atomWithObservable(() => currentAddressObservable, { initialValue: null });
export const useCurrentAddress = () => useAtomValue(currentAddressAtom);
