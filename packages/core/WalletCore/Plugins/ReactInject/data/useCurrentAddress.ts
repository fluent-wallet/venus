import { useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { catchError, filter, from, of, switchMap } from 'rxjs';
import { getAtom } from '../nexus';
import { currentAccountObservable } from './useCurrentAccount';

export const currentAddressObservable = currentAccountObservable.pipe(
  filter((account) => !!account),
  switchMap((account) => account?.currentNetworkAddressObservable.pipe(catchError(() => of(null)))),
);

export const currentAddressValueObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) => (currentAddress ? from(currentAddress.getValue()).pipe(catchError(() => of(null))) : of(null))),
);
export const currentAddressAtom = atomWithObservable(() => currentAddressObservable, { initialValue: null });
export const useCurrentAddress = () => useAtomValue(currentAddressAtom);
export const currentAddressValueAtom = atomWithObservable(() => currentAddressValueObservable, { initialValue: null });
export const useCurrentAddressValue = () => useAtomValue(currentAddressValueAtom);
export const getCurrentAddress = () => getAtom(currentAddressAtom);
export const getCurrentAddressValue = () => getAtom(currentAddressValueAtom);
