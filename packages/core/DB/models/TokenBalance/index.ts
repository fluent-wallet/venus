import { Model, type Relation } from '@nozbe/watermelondb';
import { text, immutableRelation } from '@nozbe/watermelondb/decorators';
import { type Address } from '../Address';
import { type Token } from '../Token';
import TableName from '../../TableName';

export class TokenBalance extends Model {
  static table = TableName.TokenBalance;
  static associations = {
    [TableName.Token]: { type: 'belongs_to', key: 'token_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
  } as const;

  @text('value') value!: string;
  @immutableRelation(TableName.Token, 'token_id') token!: Relation<Token>;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
}
