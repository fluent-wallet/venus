import { type Memo } from './';
import { ModelFields, createModel } from '@core/DB/helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<Memo>;
export function createMemo(params: Params, prepareCreate: true): Memo;
export function createMemo(params: Params): Promise<Memo>;
export function createMemo(params: Params, prepareCreate?: true) {
  return createModel<Memo>({ name: TableName.Memo, params, prepareCreate });
}
