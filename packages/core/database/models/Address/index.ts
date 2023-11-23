import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { text, children, relation, reader } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import { type Account } from '../Account';
import { type Network, NetworkType } from '../Network';
import { type AssetRule } from '../AssetRule';
import TableName from '../../TableName';

export class Address extends Model {
  static table = TableName.Address;
  static associations = {
    [TableName.Account]: { type: 'belongs_to', key: 'account_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.AssetRule]: { type: 'belongs_to', key: 'asset_rule_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'address_id' },
  } as const;

  /** cfx base32 address */
  @text('base32') base32!: string;
  /** ethereum hex address */
  @text('hex') hex!: string;
  @text('native_balance') nativeBalance!: string;
  @children(TableName.Tx) txs!: Query<Tx>;
  @relation(TableName.Account, 'account_id') account!: Relation<Account>;
  @relation(TableName.Network, 'network_id') network!: Relation<Network>;
  @relation(TableName.AssetRule, 'network_id') assetRule!: Relation<AssetRule>;

  @reader async getVaultType() {
    const account = await this.account;
    const accountGroup = await account.accountGroup;
    const vault = await accountGroup.vault;
    return vault.type;
  }

  /** Automatically returns the hex or base32 address depending on the type of network it belongs to */
  @reader async getValue() {
    const network = await this.network;
    if (!network) return this.hex;
    return network.networkType === NetworkType.Conflux ? this.base32 : this.hex;
  }
}
