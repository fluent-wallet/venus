import { createModel, type ModelFields } from '../../helper/modelHelper';
import TableName from '../../TableName';
import type { TxPayload } from '.';

type Params = Omit<ModelFields<TxPayload>, 'createdAt'>;
export function createTxPayload(params: Params, prepareCreate: true): TxPayload;
export function createTxPayload(params: Params): Promise<TxPayload>;
export function createTxPayload(params: Params, prepareCreate?: true) {
  return createModel<TxPayload>({ name: TableName.TxPayload, params, prepareCreate });
}
