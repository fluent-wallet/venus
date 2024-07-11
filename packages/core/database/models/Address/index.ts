import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, immutableRelation, reader, relation, text } from '@nozbe/watermelondb/decorators';
import TableName from '../../TableName';
import type { Account } from '../Account';
import type { AddressBook } from '../AddressBook';
import type { AssetRule } from '../AssetRule';
import { type Network, NetworkType } from '../Network';
import type { Signature } from '../Signature';
import type { Tx } from '../Tx';

export class Address extends Model {
  static table = TableName.Address;
  static associations = {
    [TableName.Account]: { type: 'belongs_to', key: 'account_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.AssetRule]: { type: 'belongs_to', key: 'asset_rule_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.AddressBook]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.Signature]: { type: 'has_many', foreignKey: 'address_id' },
  } as const;

  /** cfx base32 address */
  @text('base32') base32!: string;
  /** ethereum hex address */
  @text('hex') hex!: string;
  @children(TableName.Tx) txs!: Query<Tx>;
  @children(TableName.AddressBook) addressBooks!: Query<AddressBook>;
  @children(TableName.Signature) signatures!: Query<Signature>;
  @immutableRelation(TableName.Account, 'account_id') account!: Relation<Account>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
  @relation(TableName.AssetRule, 'asset_rule_id') assetRule!: Relation<AssetRule>;

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
