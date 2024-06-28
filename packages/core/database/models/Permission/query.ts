import type { Permission } from '.';
import TableName from '../../TableName';
import { type ModelFields, createModel } from '../../helper/modelHelper';

type Params = ModelFields<Permission>;
export function createPermission(params: Params, prepareCreate: true): Permission;
export function createPermission(params: Params): Promise<Permission>;
export function createPermission(params: Params, prepareCreate?: true) {
  return createModel<Permission>({ name: TableName.Permission, params, prepareCreate });
}
