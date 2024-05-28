import { type Signature } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';
import { Q } from '@nozbe/watermelondb';
import database from '../..';

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
  }: {
    sortBy?: string | string[];
    count?: number;
    skip?: number;
  } = {},
) => {
  const query: Q.Clause[] = [Q.where('address_id', addressId)];
  if (sortBy) {
    if (!Array.isArray(sortBy)) {
      query.push(Q.sortBy(sortBy, Q.desc));
    } else {
      sortBy.forEach((s) => query.push(Q.sortBy(s, Q.desc)));
    }
  }
  if (count) {
    query.push(Q.take(count));
  }
  if (skip) {
    query.push(Q.skip(skip));
  }
  return database.get<Signature>(TableName.Signature).query(...query);
};
export const observeSignatureRecords = (
  addressId: string,
  params: {
    count?: number;
    skip?: number;
  } = {},
) =>
  querySignatureRecords(addressId, {
    ...params,
    sortBy: ['block_number', 'created_at'],
  }).observeWithColumns(['block_number']);

export const observeSignatureRecordsCount = (addressId: string) => querySignatureRecords(addressId).observeCount(false);
