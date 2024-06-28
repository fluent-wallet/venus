import type { TxExtra } from '.';
import TableName from '../../TableName';
import { type ModelFields, createModel } from '../../helper/modelHelper';

type Params = Omit<ModelFields<TxExtra>, 'createdAt'>;
export function createTxExtra(params: Params, prepareCreate: true): TxExtra;
export function createTxExtra(params: Params): Promise<TxExtra>;
export function createTxExtra(params: Params, prepareCreate?: true) {
  return createModel<TxExtra>({ name: TableName.TxExtra, params, prepareCreate });
}
