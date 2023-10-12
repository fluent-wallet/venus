import { Model, type Relation } from '@nozbe/watermelondb';
import { text, relation } from '@nozbe/watermelondb/decorators';
import { type Network } from '../Network';
import TableName from '../../TableName';

export class Memo extends Model {
  static table = TableName.Memo;
  static associations = {
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
  } as const;

  @text('name') name!: string;
  @text('address') address!: string;
  @relation(TableName.Network, 'network_id') network!: Relation<Network>;
}
