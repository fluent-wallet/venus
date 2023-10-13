import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation } from '@nozbe/watermelondb/decorators';
import { type TokenBalance } from '../TokenBalance';
import { type TokenList } from '../TokenList';
import { type Network } from '../Network';
import { type Address } from '../Address';
import { type Tx } from '../Tx';
import TableName from '../../TableName';

export class Token extends Model {
  static table = TableName.Token;
  static associations = {
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.TokenList]: { type: 'belongs_to', key: 'token_list_id' },
    [TableName.TokenBalance]: { type: 'has_many', foreignKey: 'token_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'token_id' },
  } as const;

  @text('name') name!: string;
  @text('token_address') tokenAddress!: string;
  @text('symbol') symbol!: string | null;
  @field('decimals') decimals!: number | null;
  @text('logo_uri') logoURI!: string | null;
  @field('from_list') fromList!: boolean;
  @field('from_app') fromApp!: boolean;
  @field('from_user') fromUser!: boolean;
  @children(TableName.TokenBalance) tokenBalance!: Query<TokenBalance>;
  @children(TableName.Tx) tx!: Query<Tx>;
  @immutableRelation(TableName.TokenList, 'token_list_id') tokenList!: Relation<TokenList>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
}
