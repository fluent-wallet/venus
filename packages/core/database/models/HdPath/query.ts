import type { HdPath } from '.';
import TableName from '../../TableName';
import { type ModelFields, createModel } from '../../helper/modelHelper';

type Params = ModelFields<HdPath>;
export function createHdPath(params: Params, prepareCreate: true): HdPath;
export function createHdPath(params: Params): Promise<HdPath>;
export function createHdPath(params: Params, prepareCreate?: true) {
  return createModel<HdPath>({ name: TableName.HdPath, params, prepareCreate });
}
