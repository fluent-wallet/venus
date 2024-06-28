import { Model, type Relation } from '@nozbe/watermelondb';
import { immutableRelation, text } from '@nozbe/watermelondb/decorators';
import TableName from '../../TableName';
import type { Address } from '../Address';
import type { Network } from '../Network';

export enum AddressType {
  EOA = 'EOA',
  Contract = 'Contract',
}

export class AddressBook extends Model {
  static table = TableName.Address;
  static associations = {
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
  } as const;

  @text('name') name!: string;
  @text('address_value') addressValue!: string;
  @text('type') type!: AddressType;
  @immutableRelation(TableName.Address, 'address_id') account!: Relation<Address>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
}
