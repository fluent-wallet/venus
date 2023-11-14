import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { text, children, relation, reader } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import { type Account } from '../Account';
import { type Network } from '../Network';
import { type Token } from '../Token';
import { type TokenBalance } from '../TokenBalance';
import TableName from '../../TableName';

export class Address extends Model {
  static table = TableName.Address;
  static associations = {
    [TableName.Account]: { type: 'belongs_to', key: 'account_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Token]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.TokenBalance]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'address_id' },
  } as const;

  /** cfx base32 address */
  @text('base32') base32!: string;
  /** ethereum hex address */
  @text('hex') hex!: string;
  @text('native_balance') nativeBalance!: string;
  @children(TableName.Token) tokens!: Query<Token>;
  @children(TableName.TokenBalance) tokenBalances!: Query<TokenBalance>;
  @children(TableName.Tx) txs!: Query<Tx>;
  @relation(TableName.Account, 'account_id') account!: Relation<Account>;
  @relation(TableName.Network, 'network_id') network!: Relation<Network>;

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
    return network.networkType === 'cfx' ? this.base32 : this.hex;
  }

  // /** Get the private key for the address */
  // @reader async getPrivateKey() {
  //   const vault = await (await (await this.account).accountGroup).vault;
  //   if (vault.type === 'public_address') throw new Error('Cannot get private key from public_address wallet');
  //   if (vault.type === 'hardware') throw new Error('Cannot get private key from hardware wallet');
  //   if (vault.type === 'BSIM') throw new Error('Cannot get private key from BSIM wallet');

  //   const data = vault.data
  //   if (vault.type === 'private_key') return data;

  //   const mnemonic = data!;
  //   const hdPath = await (await this.network).hdPath;
  //   const thisAccount = await this.account;
  //   const { privateKey } = await getNthAccountOfHDKey({
  //     mnemonic,
  //     hdPath: hdPath.value,
  //     nth: thisAccount.index,
  //   });
  //   return privateKey;
  // }
}
