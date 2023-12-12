import { type Tx } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';
import database from '../..';
import { Q, Query } from '@nozbe/watermelondb';
import { TxStatus } from './type';

export type TxParams = Omit<ModelFields<Tx>, 'createdAt'>;
export function createTx(params: TxParams, prepareCreate: true): Tx;
export function createTx(params: TxParams): Promise<Tx>;
export function createTx(params: TxParams, prepareCreate?: true) {
  return createModel<Tx>({ name: TableName.Tx, params, prepareCreate });
}

export const queryUnfinishedTx = () =>
  database
    .get(TableName.Tx)
    .query(
      Q.where('status', Q.oneOf([TxStatus.UNSENT, TxStatus.SENDING, TxStatus.PENDING, TxStatus.PACKAGED, TxStatus.EXECUTED]))
    ) as unknown as Query<Tx>;

export const observeUnfinishedTx = () => queryUnfinishedTx().observe();
