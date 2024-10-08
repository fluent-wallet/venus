import type { Signature } from '@core/database/models/Signature';
import { SignatureFilterOption } from '@core/database/models/Signature/type';
import { atom, useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { useCallback } from 'react';
import { filter, switchMap } from 'rxjs';
import { observeSignatureById, observeSignatureRecordsCount, querySignatureRecords } from '../../../../database/models/Signature/query';
import { getAtom, setAtom } from '../nexus';
import { currentAddressObservable } from './useCurrentAddress';

const signatureRecordsCountAtom = atomFamily((_filter: SignatureFilterOption) =>
  atomWithObservable(
    () =>
      currentAddressObservable.pipe(
        filter((value) => value !== null),
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

const appAtomFamilyOfSignature = atomFamily((signatureId: string) =>
  atomWithObservable(() => observeSignatureById(signatureId).pipe(switchMap((s) => s.observeApp())), { initialValue: null }),
);
export const useAppOfSignature = (signatureId: string) => useAtomValue(appAtomFamilyOfSignature(signatureId));

const txAtomFamilyOfSignature = atomFamily((signatureId: string) =>
  atomWithObservable(() => observeSignatureById(signatureId).pipe(switchMap((s) => s.observeTx())), { initialValue: null }),
);
export const useTxOfSignature = (signatureId: string) => useAtomValue(txAtomFamilyOfSignature(signatureId));
