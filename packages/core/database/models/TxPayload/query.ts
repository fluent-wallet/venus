import type { TxPayload } from '.';
import TableName from '../../TableName';
import { type ModelFields, createModel } from '../../helper/modelHelper';

type Params = Omit<ModelFields<TxPayload>, 'createdAt'>;
export function createTxPayload(params: Params, prepareCreate: true): TxPayload;
export function createTxPayload(params: Params): Promise<TxPayload>;
export function createTxPayload(params: Params, prepareCreate?: true) {
  return createModel<TxPayload>({ name: TableName.TxPayload, params, prepareCreate });
}
