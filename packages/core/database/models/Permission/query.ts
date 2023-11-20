import { type Permission } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<Permission>;
export function createPermission(params: Params, prepareCreate: true): Permission;
export function createPermission(params: Params): Promise<Permission>;
export function createPermission(params: Params, prepareCreate?: true) {
  return createModel<Permission>({ name: TableName.Permission, params, prepareCreate });
}
