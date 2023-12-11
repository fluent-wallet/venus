import { type Tx } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';
import database from '../..';
import { Q, Query } from '@nozbe/watermelondb';
import { TxStatus } from './type';

type Params = Omit<ModelFields<Tx>, 'createdAt'>;
export function createTx(params: Params, prepareCreate: true): Tx;
export function createTx(params: Params): Promise<Tx>;
export function createTx(params: Params, prepareCreate?: true) {
  return createModel<Tx>({ name: TableName.Tx, params, prepareCreate });
}

export const queryUnfinishedTx = () =>
  database
    .get(TableName.Tx)
    .query(
      Q.where('status', Q.oneOf([TxStatus.UNSENT, TxStatus.SENDING, TxStatus.PENDING, TxStatus.PACKAGED, TxStatus.EXECUTED]))
    ) as unknown as Query<Tx>;

export const observeUnfinishedTx = () => queryUnfinishedTx().observe();
