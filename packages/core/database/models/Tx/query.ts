import { type Tx } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';
import database from '../..';
import { Q } from '@nozbe/watermelondb';
import { ALL_TX_STATUSES, PENDING_TX_STATUSES, TxStatus } from './type';
import { memoize } from 'lodash-es';

export type TxParams = Omit<ModelFields<Tx>, 'createdAt'>;
export function createTx(params: TxParams, prepareCreate: true): Tx;
export function createTx(params: TxParams): Promise<Tx>;
export function createTx(params: TxParams, prepareCreate?: true) {
  return createModel<Tx>({ name: TableName.Tx, params, prepareCreate });
}

export const queryTxsWithAddress = (
  addressId: string,
  {
    inStatuses = ALL_TX_STATUSES,
    notInStatuses,
    sortBy,
  }: {
    inStatuses?: TxStatus[];
    notInStatuses?: TxStatus[];
    sortBy?: string | string[];
  },
) => {
  const query: Q.Clause[] = [Q.where('address_id', addressId), Q.where('is_temp_replaced', Q.notEq(true)), Q.where('status', Q.oneOf(inStatuses))];
  if (notInStatuses) {
    query.push(Q.where('status', Q.notIn(notInStatuses)));
  }
  if (sortBy) {
    if (!Array.isArray(sortBy)) {
      query.push(Q.sortBy(sortBy, Q.desc));
    } else {
      sortBy.forEach((s) => query.push(Q.sortBy(s, Q.desc)));
    }
  }
  return database.get<Tx>(TableName.Tx).query(...query);
};

export const observeTxById = memoize((txId: string) => database.get<Tx>(TableName.Tx).findAndObserve(txId));

export const observeFinishedTxWithAddress = (addressId: string) =>
  queryTxsWithAddress(addressId, {
    notInStatuses: PENDING_TX_STATUSES,
    sortBy: ['executed_at', 'created_at'],
  }).observeWithColumns(['status', 'polling_count', 'resend_count', 'confirmed_number']);

export const observeUnfinishedTxWithAddress = (addressId: string) =>
  queryTxsWithAddress(addressId, {
    inStatuses: PENDING_TX_STATUSES,
    sortBy: 'created_at',
  }).observeWithColumns(['status', 'polling_count', 'resend_count', 'confirmed_number']);

// find tx with
// 1. same addr
// 2. same nonce
// 3. not in end state
export const queryDuplicateTx = (tx: Tx, nonce: number, statuses = ALL_TX_STATUSES) =>
  database
    .get<Tx>(TableName.Tx)
    .query(
      Q.experimentalJoinTables([TableName.Address, TableName.TxPayload]),
      Q.on(TableName.Address, Q.where('id', tx.address.id)),
      Q.on(TableName.TxPayload, Q.where('nonce', nonce)),
      Q.where('status', Q.oneOf(statuses)),
      Q.where('id', Q.notEq(tx.id)),
      Q.sortBy('created_at', Q.desc),
    );
