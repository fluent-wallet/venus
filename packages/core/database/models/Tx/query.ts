import { type Tx } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = Omit<ModelFields<Tx>, 'createdAt'>;
export function createTx(params: Params, prepareCreate: true): Tx;
export function createTx(params: Params): Promise<Tx>;
export function createTx(params: Params, prepareCreate?: true) {
  return createModel<Tx>({ name: TableName.Tx, params, prepareCreate });
}
