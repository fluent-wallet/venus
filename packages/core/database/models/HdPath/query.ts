import { type HdPath } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<HdPath>;
export function createHdPath(params: Params, prepareCreate: true): HdPath;
export function createHdPath(params: Params): Promise<HdPath>;
export function createHdPath(params: Params, prepareCreate?: true) {
  return createModel<HdPath>({ name: TableName.HdPath, params, prepareCreate });
}
