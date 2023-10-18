import { Model, type Query } from '@nozbe/watermelondb';
import { text, children } from '@nozbe/watermelondb/decorators';
import { type Network } from '../Network';
import TableName from '../../TableName';
import { createModel, type ModelFields } from '../../helper/modelHelper';

export class HdPath extends Model {
  static table = TableName.HdPath;
  static associations = {
    [TableName.Network]: { type: 'has_many', foreignKey: 'hd_path_id' },
  } as const;

  @text('name') name!: 'cfx-default' | 'eth-default';
  @text('value') value!: string;
  @children(TableName.Network) network!: Query<Network>;
}

type Params = ModelFields<HdPath>;
export function createHdPath(params: Params, prepareCreate: true): HdPath;
export function createHdPath(params: Params): Promise<HdPath>;
export function createHdPath(params: Params, prepareCreate?: true) {
  return createModel<HdPath>({ name: TableName.HdPath, params, prepareCreate });
}
