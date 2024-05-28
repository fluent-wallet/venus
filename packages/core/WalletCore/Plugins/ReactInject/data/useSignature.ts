import { useCallback } from 'react';
import { useAtomValue, atom } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { switchMap, filter } from 'rxjs';
import { observeSignatureRecordsCount, querySignatureRecords } from '../../../../database/models/Signature/query';
import { currentAddressObservable } from './useCurrentAddress';
import { Signature } from '@core/database/models/Signature';
import { getAtom, setAtom } from '../nexus';
import { notNull } from '@core/utils/rxjs';

const signatureRecordsCountObservable = currentAddressObservable.pipe(
  filter(notNull),
  switchMap((currentAddress) => observeSignatureRecordsCount(currentAddress.id)),
);
const signatureRecordsCountAtom = atomWithObservable(() => signatureRecordsCountObservable, { initialValue: 0 });

const signatureRecordsAtom = atom<Signature[]>([]);
export const useSignatureRecords = () => {
  const records = useAtomValue(signatureRecordsAtom);
  const total = useAtomValue(signatureRecordsCountAtom);
  return {
    total,
    records,
    setRecords: useCallback((data: Signature[], merge = true) => {
      const prev = getAtom(signatureRecordsAtom);
      if (merge) {
        setAtom(signatureRecordsAtom, [...prev, ...data]);
      } else {
        setAtom(signatureRecordsAtom, data);
      }
    }, []),
    resetRecords: useCallback(() => setAtom(signatureRecordsAtom, []), []),
  };
};

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
