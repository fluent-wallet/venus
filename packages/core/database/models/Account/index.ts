import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { children, date, field, immutableRelation, lazy, reader, readonly, text, writer } from '@nozbe/watermelondb/decorators';
import { firstValueFrom, map } from 'rxjs';
import TableName from '../../TableName';
import type { AccountGroup } from '../AccountGroup';
import type { Address } from '../Address';
import type { Permission } from '../Permission';

export class Account extends Model {
  static table = TableName.Account;
  static associations = {
    [TableName.AccountGroup]: { type: 'belongs_to', key: 'account_group_id' },
    [TableName.Address]: { type: 'has_many', foreignKey: 'account_id' },
    [TableName.Permission]: { type: 'has_many', foreignKey: 'account_id' },
  } as const;

  @field('index') index!: number;
  @text('nickname') nickname!: string;
  @field('hidden') hidden!: boolean;
  @field('selected') selected!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @children(TableName.Address) addresses!: Query<Address>;
  @children(TableName.Permission) permissions!: Query<Permission>;
  @immutableRelation(TableName.AccountGroup, 'account_group_id') accountGroup!: Relation<AccountGroup>;

  @lazy currentNetworkAddressObservable = this.addresses
    .extend(Q.on(TableName.Network, Q.where('selected', true)))
    .observe()
    .pipe(map((addresses) => addresses?.[0]));

  @lazy currentNetworkAddress = firstValueFrom(this.currentNetworkAddressObservable);

  @reader async getVaultType() {
    const accountGroup = await this.accountGroup;
    const vault = await accountGroup.vault;
    return vault.type;
  }

  @writer async updateName(newNickName: string) {
    await this.update((account) => {
      account.nickname = newNickName;
    });
  }

  @writer async changeHidden(hidden: boolean) {
    if (this.hidden === hidden) return;
    if (hidden === true) {
      const vault = await (await this.accountGroup).vault;
      if (vault.type !== 'hierarchical_deterministic' && vault.type !== 'BSIM') {
        throw Error('Accounts that are not part of a Group cannot be hidden.');
      }

      const visibleCountsOfAccountGroup = await (await this.accountGroup).visibleAccounts.count;
      if (visibleCountsOfAccountGroup <= 1) {
        throw Error('Keep at least one account.');
      }
    }
    await this.update((account) => {
      account.hidden = hidden;
    });
  }

  prepareChangeHidden(hidden: boolean) {
    return this.prepareUpdate((account) => {
      account.hidden = hidden;
    });
  }

  @writer async changeSelected(selected: boolean) {
    await this.update((account) => {
      account.selected = selected;
    });
  }
}
