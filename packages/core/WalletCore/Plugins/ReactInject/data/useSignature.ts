import type { Signature } from '@core/database/models/Signature';
import { SignatureFilterOption } from '@core/database/models/Signature/type';
import { notNull } from '@core/utils/rxjs';
import { atom, useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { useCallback } from 'react';
import { filter, switchMap } from 'rxjs';
import { observeSignatureRecordsCount, querySignatureRecords } from '../../../../database/models/Signature/query';
import { getAtom, setAtom } from '../nexus';
import { currentAddressObservable } from './useCurrentAddress';

const signatureRecordsCountAtom = atomFamily((_filter: SignatureFilterOption) =>
  atomWithObservable(
    () =>
      currentAddressObservable.pipe(
        filter(notNull),
        switchMap((currentAddress) => observeSignatureRecordsCount(currentAddress.id, _filter)),
      ),
    { initialValue: null },
  ),
);

const signatureRecordsAtom = atom<Signature[]>([]);
export const useSignatureRecords = (_filter = SignatureFilterOption.All) => {
  const records = useAtomValue(signatureRecordsAtom);
  const total = useAtomValue(signatureRecordsCountAtom(_filter));
  return {
    total,
    records,
    setRecords: useCallback((data: Signature[]) => {
      const prev = getAtom(signatureRecordsAtom);
      setAtom(signatureRecordsAtom, [...prev, ...data]);
    }, []),
    resetRecords: useCallback(() => setAtom(signatureRecordsAtom, []), []),
  };
};

export const fetchSignatureRecords = async (
  addressId: string,
  params: {
    pageSize: number;
    current: number;
    offset?: number;
    filter?: SignatureFilterOption;
  },
) => {
  const { pageSize, current, offset = 0, filter = SignatureFilterOption.All } = params;
  const data = await querySignatureRecords(addressId, {
    count: pageSize,
    skip: current * pageSize + offset,
    sortBy: ['block_number', 'created_at'],
    filter,
  });
  return data;
};

const appAtomFamilyOfSignature = atomFamily((s: Signature) => atomWithObservable(() => s.observeApp(), { initialValue: null }));
export const useAppOfSignature = (s: Signature) => useAtomValue(appAtomFamilyOfSignature(s));

const txAtomFamilyOfSignature = atomFamily((s: Signature) => atomWithObservable(() => s.observeTx(), { initialValue: null }));
export const useTxOfSignature = (s: Signature) => useAtomValue(txAtomFamilyOfSignature(s));
