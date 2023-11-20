import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, from, of } from 'rxjs';
import { currentAccountObservable } from './useCurrentAccount';

export const currentAddressObservable = currentAccountObservable.pipe(switchMap((account) => (account ? from(account.currentNetworkAddressObservable) : of(null))));
const currentAddressValueObservable = currentAddressObservable.pipe(switchMap((currentAddress) => (currentAddress ? from(currentAddress.getValue()) : of(null))));

export const currentAddressAtom = atomWithObservable(() => currentAddressObservable, { initialValue: null });
export const useCurrentAddress = () => useAtomValue(currentAddressAtom);
export const currentAddressValueAtom = atomWithObservable(() => currentAddressValueObservable, { initialValue: null });
export const useCurrentAddressValue = () => useAtomValue(currentAddressValueAtom);
