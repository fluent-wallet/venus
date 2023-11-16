import { Q, Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, relation, date, readonly, writer, reader, lazy } from '@nozbe/watermelondb/decorators';
import { map } from 'rxjs';
import { type Address } from '../Address';
import { type AccountGroup } from '../AccountGroup';
import TableName from '../../TableName';

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
  @children(TableName.Address) addresses!: Query<Address>;
  @relation(TableName.AccountGroup, 'account_group_id') accountGroup!: Relation<AccountGroup>;

  @lazy currentNetworkAddress = this.addresses
    .extend(Q.on(TableName.Network, Q.where('selected', true)))
    .observe()
    .pipe(map((addresses) => addresses[0]));

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
