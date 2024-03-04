import { Model, type Relation } from '@nozbe/watermelondb';
import { text, immutableRelation } from '@nozbe/watermelondb/decorators';
import { type Address } from '../Address';
import { type Network } from '../Network';
import TableName from '../../TableName';

export class AddressBook extends Model {
  static table = TableName.Address;
  static associations = {
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
  } as const;

  @text('name') name!: string;
  @text('address_value') addressValue!: string;
  @immutableRelation(TableName.Address, 'address_id') account!: Relation<Address>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
}
