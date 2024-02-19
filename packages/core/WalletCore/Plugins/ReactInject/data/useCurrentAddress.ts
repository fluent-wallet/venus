import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, from, filter, of, catchError } from 'rxjs';
import { currentAccountObservable } from './useCurrentAccount';
import { getAtom } from '../nexus';

export const currentAddressObservable = currentAccountObservable.pipe(
  filter((account) => !!account),
  switchMap((account) => account?.currentNetworkAddressObservable.pipe(catchError(() => of(null))))
);

const currentAddressValueObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) => (currentAddress ? from(currentAddress.getValue()).pipe(catchError(() => of(null))) : of(null)))
);
export const currentAddressAtom = atomWithObservable(() => currentAddressObservable, { initialValue: null });
export const useCurrentAddress = () => useAtomValue(currentAddressAtom);
export const currentAddressValueAtom = atomWithObservable(() => currentAddressValueObservable, { initialValue: null });
export const useCurrentAddressValue = () => useAtomValue(currentAddressValueAtom);
export const getCurrentAddress = () => getAtom(currentAddressAtom);
