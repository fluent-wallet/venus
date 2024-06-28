import { Model, type Query } from '@nozbe/watermelondb';
import { children, text } from '@nozbe/watermelondb/decorators';
import TableName from '../../TableName';
import type { Network } from '../Network';

/** Paths for mnemonic generation */
export class HdPath extends Model {
  static table = TableName.HdPath;
  static associations = {
    [TableName.Network]: { type: 'has_many', foreignKey: 'hd_path_id' },
  } as const;

  @text('name') name!: string;
  @text('value') value!: string;
  @children(TableName.Network) network!: Query<Network>;
}
