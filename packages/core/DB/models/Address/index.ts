import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { text, children, relation, reader } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import { type Account } from '../Account';
import { type Network } from '../Network';
import { type Token } from '../Token';
import { type TokenBalance } from '../TokenBalance';
import TableName from '../../TableName';
import { createModel } from '../../helper/modelHelper';
import { encode } from '../../../utils/address';
import { toAccountAddress } from '../../../utils/account';
import { getNthAccountOfHDKey } from '../../../utils/hdkey';

export class Address extends Model {
  static table = TableName.Address;
  static associations = {
    [TableName.Account]: { type: 'belongs_to', key: 'account_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Token]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.TokenBalance]: { type: 'has_many', foreignKey: 'address_id' },
    [TableName.Tx]: { type: 'has_many', foreignKey: 'address_id' },
  } as const;

  @text('base32') base32!: string;
  @text('hex') hex!: string;
  @text('native_balance') nativeBalance!: string;
  @children(TableName.Token) token!: Query<Token>;
  @children(TableName.TokenBalance) tokenBalance!: Query<TokenBalance>;
  @children(TableName.Tx) tx!: Query<Tx>;
  @relation(TableName.Account, 'account_id') account!: Relation<Account>;
  @relation(TableName.Network, 'network_id') network!: Relation<Network>;

  @reader async value() {
    const network = await this.network;
    if (!network) return this.hex;
    return network.networkType === 'cfx' ? this.base32 : this.hex;
  }

  @reader async getPrivateKey() {
    const vault = await (await (await this.account).accountGroup).vault;
    if (vault.type === 'public_address') throw new Error('Cannot get private key from public address');
    if (vault.type === 'hardware') throw new Error('Cannot get private key from hardware wallet');

    const data = await vault.getData();
    if (vault.type === 'private_key') return data;

    const mnemonic = data;
    const hdPath = await (await this.network).hdPath;
    const thisAccount = await this.account;
    const accountGroup = await thisAccount.accountGroup;
    const { privateKey } = await getNthAccountOfHDKey({
      mnemonic,
      hdPath: hdPath.value,
      nth: await accountGroup.getAccountIndex(thisAccount),
    });
    return privateKey;
  }
}

type Params = { hex: string; nativeBalance?: string; account: Account; network: Network };
export function createAddress(params: Params, prepareCreate: true): Address;
export function createAddress(params: Params): Promise<Address>;
export function createAddress({ hex, nativeBalance, network, account }: Params, prepareCreate?: true) {
  if (!network) throw new Error('Network is required in createAddress.');
  return createModel<Address>({
    name: TableName.Address,
    params: { hex, nativeBalance: nativeBalance ?? '0x0', base32: network ? encode(toAccountAddress(hex), network.netId) : '', account },
    prepareCreate,
  });
}
