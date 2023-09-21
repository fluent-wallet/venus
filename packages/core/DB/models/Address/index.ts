import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { text, children, relation } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import { type Account } from '../Account';
import { type Network } from '../Network';
import { type Token } from '../Token';
import { type TokenBalance } from '../TokenBalance';
import { TableName } from '../../index';

export class Address extends Model {
  static table = TableName.Address;
  static associations = {
    [TableName.Account]: { type: 'belongs_to', key: 'account_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Token]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.TokenBalance]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'address_id' },
  } as const;

  @text('value') value!: string;
  @text('hex') hex!: string;
  @text('pk') pk!: string;
  @text('native_balance') nativeBalance!: string;
  @children(TableName.Token) token!: Query<Token>;
  @children(TableName.TokenBalance) tokenBalance!: Query<TokenBalance>;
  @children(TableName.Tx) tx!: Query<Tx>;
  @relation(TableName.Account, 'account_id') account!: Relation<Account>;
  @relation(TableName.Network, 'network_id') network!: Relation<Network>;
}
