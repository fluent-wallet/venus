import { type TxExtra } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = Omit<ModelFields<TxExtra>, 'createdAt'>;
export function createTxExtra(params: Params, prepareCreate: true): TxExtra;
export function createTxExtra(params: Params): Promise<TxExtra>;
export function createTxExtra(params: Params, prepareCreate?: true) {
  return createModel<TxExtra>({ name: TableName.TxExtra, params, prepareCreate });
}
