import { Q } from '@nozbe/watermelondb';
import type { Signature } from '.';
import database from '../..';
import TableName from '../../TableName';
import { type ModelFields, createModel } from '../../helper/modelHelper';
import { SignatureFilterOption } from './type';
import { memoize } from 'lodash-es';

export type SignatureParams = Omit<ModelFields<Signature>, 'createdAt'>;
export function createSignature(params: SignatureParams, prepareCreate?: true) {
  return createModel<Signature>({ name: TableName.Signature, params, prepareCreate });
}

export const querySignatureRecords = (
  addressId: string,
  {
    sortBy,
    count,
    skip,
    filter = SignatureFilterOption.All,
  }: {
    sortBy?: string | string[];
    count?: number;
    skip?: number;
    filter?: SignatureFilterOption;
  } = {},
) => {
  const query: Q.Clause[] = [Q.where('address_id', addressId)];
  if (sortBy) {
    if (!Array.isArray(sortBy)) {
      query.push(Q.sortBy(sortBy, Q.desc));
    } else {
      for (let i = 0; i < sortBy.length; i++) {
        const s = sortBy[i];
        query.push(Q.sortBy(s, Q.desc));
      }
    }
  }
  if (count) {
    query.push(Q.take(count));
  }
  if (skip) {
    query.push(Q.skip(skip));
  }
  if (filter !== SignatureFilterOption.All) {
    query.push(Q.where('tx_id', filter === SignatureFilterOption.Transactions ? Q.notEq(null) : Q.eq(null)));
  }
  return database.get<Signature>(TableName.Signature).query(...query);
};
export const observeSignatureRecords = (
  addressId: string,
  params: {
    count?: number;
    skip?: number;
    filter?: SignatureFilterOption;
  } = {},
) =>
  querySignatureRecords(addressId, {
    ...params,
    sortBy: ['block_number', 'created_at'],
  }).observeWithColumns(['block_number']);

export const observeSignatureRecordsCount = (addressId: string, filter?: SignatureFilterOption) =>
  querySignatureRecords(addressId, {
    filter,
  }).observeCount(false);

export const observeSignatureById = memoize((signatureId: string) => database.get<Signature>(TableName.Signature).findAndObserve(signatureId));
