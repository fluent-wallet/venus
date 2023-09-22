import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, relation, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import { type Address } from '../Address';
import { type AccountGroup } from '../AccountGroup';
import { type Network } from '../Network';
import { TableName } from '../../index';
import { encode } from '../../../utils/address';
import { toAccountAddress } from '../../../utils/account';

export class Account extends Model {
  static table = TableName.Account;
  static associations = {
    [TableName.Address]: { type: 'has_many', foreignKey: 'account_id' },
    [TableName.AccountGroup]: { type: 'belongs_to', key: 'account_group_id' },
  } as const;

  @field('index') index!: number;
  @text('nickname') nickname!: string;
  @field('hidden') hidden!: boolean;
  @field('selected') selected!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @children(TableName.Address) address!: Query<Address>;
  @relation(TableName.AccountGroup, 'account_group_id') accountGroup!: Relation<AccountGroup>;

  @writer async updateName(newNickName: string) {
    await this.update((account) => {
      account.nickname = newNickName;
    });
  }

  @writer async switchHidden() {
    await this.update((account) => {
      account.hidden = !account.hidden;
    });
  }

  @writer async hide() {
    if (this.hidden === true) return;

    const hiddenCountOfAccountGroup = await (await this.accountGroup).hiddenAccounts.count;
    if (hiddenCountOfAccountGroup <= 1) {
      throw Error('Keep at least one account');
    }

    await this.update((account) => {
      account.hidden = true;
    });
  }

  @writer async switchSelected() {
    await this.update((account) => {
      account.selected = !account.selected;
    });
  }

  createAddress(params: { network: Network; hex: string; pk: string; nativeBalance?: string; prepareCreate: true }): Address;
  createAddress(params: { network: Network; hex: string; pk: string; nativeBalance?: string;}): Promise<Address>;
  @writer createAddress({
    network,
    hex,
    pk,
    nativeBalance = '0x0',
    prepareCreate,
  }: {
    network: Network;
    hex: string;
    pk: string;
    nativeBalance?: string;
    prepareCreate?: boolean;
  }) {
    const newAddress = this.collections.get(TableName.Address)[prepareCreate ? 'prepareCreate' : 'create']((_newAddress) => {
      const newAddress = _newAddress as Address;
      newAddress.account.set(this);
      newAddress.network.set(network);
      newAddress.value = network.networkType === 'cfx' ? encode(toAccountAddress(hex), network.netId) : hex;
      newAddress.hex = hex;
      newAddress.pk = pk;
      newAddress.nativeBalance = nativeBalance;
    });
    return newAddress;
  }
}
