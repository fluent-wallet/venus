import { useAtomValue, atom } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, of } from 'rxjs';
import { observeSignatureRecordsCount, querySignatureRecords } from '../../../../database/models/Signature/query';
import { currentAddressObservable } from './useCurrentAddress';
import { Signature } from '@core/database/models/Signature';
import { getAtom, setAtom } from '../nexus';

export const signatureRecordsCountObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) => (currentAddress ? observeSignatureRecordsCount(currentAddress.id) : of(0))),
);
const signatureRecordsCountAtom = atomWithObservable(() => signatureRecordsCountObservable, { initialValue: 0 });

const signatureRecordsAtom = atom<Signature[]>([]);
export const useSignatureRecords = () => useAtomValue(signatureRecordsAtom);
export const setSignatureRecords = (data: Signature[], merge = true) => {
  const prev = getAtom(signatureRecordsAtom);
  if (merge) {
    setAtom(signatureRecordsAtom, [...prev, ...data]);
  } else {
    setAtom(signatureRecordsAtom, data);
  }
};
export const useSignatureRecordsCount = () => useAtomValue(signatureRecordsCountAtom);
export const resetSignatureRecords = () => setSignatureRecords([], false);

export const fetchSignatureRecords = async (
  addressId: string,
  params: {
    pageSize: number;
    current: number;
  },
) => {
  const { pageSize, current } = params;
  const data = await querySignatureRecords(addressId, {
    count: pageSize,
    skip: current * pageSize,
    sortBy: ['block_number', 'created_at'],
  });
  return data;
};
