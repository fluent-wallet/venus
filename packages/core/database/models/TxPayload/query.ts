import { type TxPayload } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<TxPayload>;
export function createTxPayload(params: Params, prepareCreate: true): TxPayload;
export function createTxPayload(params: Params): Promise<TxPayload>;
export function createTxPayload(params: Params, prepareCreate?: true) {
  return createModel<TxPayload>({ name: TableName.TxPayload, params, prepareCreate });
}
