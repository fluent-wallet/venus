import { useAtomValue } from 'jotai';
import { atomWithObservable, atomFamily } from 'jotai/utils';
import { switchMap, of } from 'rxjs';
import { observeSignatureRecords, observeSignatureRecordsCount } from '../../../../database/models/Signature/query';
import { currentAddressObservable } from './useCurrentAddress';

export const signatureRecordsObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) => (currentAddress ? observeSignatureRecords(currentAddress.id) : of([]))),
);

export const signatureRecordsCountObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) => (currentAddress ? observeSignatureRecordsCount(currentAddress.id) : of(0))),
);
const signatureRecordsCountAtom = atomWithObservable(() => signatureRecordsCountObservable, { initialValue: 0 });

// const signatureRecordsAtom = atomWithObservable(() => signatureRecordsObservable, { initialValue: [] });
const signatureRecordsAtom = atomFamily((count: number) =>
  atomWithObservable(
    () =>
      currentAddressObservable.pipe(
        switchMap((currentAddress) =>
          currentAddress
            ? observeSignatureRecords(currentAddress.id, {
                count,
              })
            : of([]),
        ),
      ),
    { initialValue: [] },
  ),
);
export const useSignatureRecords = (count = 10) => useAtomValue(signatureRecordsAtom(count));
export const useSignatureRecordsCount = () => useAtomValue(signatureRecordsCountAtom);
