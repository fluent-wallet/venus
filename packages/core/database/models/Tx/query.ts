import { type Tx } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';
import database from '../..';
import { Q } from '@nozbe/watermelondb';
import { TxStatus } from './type';
import { memoize } from 'lodash-es';

export type TxParams = Omit<ModelFields<Tx>, 'createdAt'>;
export function createTx(params: TxParams, prepareCreate: true): Tx;
export function createTx(params: TxParams): Promise<Tx>;
export function createTx(params: TxParams, prepareCreate?: true) {
  return createModel<Tx>({ name: TableName.Tx, params, prepareCreate });
}

export const observeTxById = memoize((txId: string) => database.get<Tx>(TableName.Tx).findAndObserve(txId));

export const queryFinishedTxs = () =>
  database
    .get<Tx>(TableName.Tx)
    .query(
      Q.where('status', Q.oneOf([TxStatus.FAILED, TxStatus.SKIPPED, TxStatus.CONFIRMED])),
      Q.sortBy('executed_at', Q.desc),
      Q.sortBy('created_at', Q.desc)
    );

export const observeFinishedTxs = () => queryFinishedTxs().observe();

export const queryUnfinishedTx = () =>
  database
    .get<Tx>(TableName.Tx)
    .query(
      Q.where('status', Q.oneOf([TxStatus.UNSENT, TxStatus.SENDING, TxStatus.PENDING, TxStatus.PACKAGED, TxStatus.EXECUTED])),
      Q.sortBy('created_at', Q.desc)
    );

export const observeUnfinishedTx = () => queryUnfinishedTx().observe();

// find tx with
// 1. same addr
// 2. same nonce
// 3. not in end state
export const queryDuplicateTx = (tx: Tx, nonce: string) =>
  database
    .get<Tx>(TableName.Tx)
    .query(
      Q.experimentalJoinTables([TableName.Address, TableName.TxPayload]),
      Q.and(
        Q.on(TableName.Address, Q.where('id', tx.address.id)),
        Q.on(TableName.TxPayload, Q.where('nonce', nonce)),
        Q.where('status', Q.oneOf([TxStatus.UNSENT, TxStatus.SENDING, TxStatus.PENDING, TxStatus.PACKAGED, TxStatus.EXECUTED])),
        Q.where('id', Q.notEq(tx.id))
      )
    );
