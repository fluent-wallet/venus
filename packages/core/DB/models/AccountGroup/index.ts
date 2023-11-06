import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation, writer, reader, lazy } from '@nozbe/watermelondb/decorators';
import { map } from 'rxjs';
import { type Vault } from '../Vault';
import { type Account } from '../Account';
import TableName from '../../TableName';

export class AccountGroup extends Model {
  static table = TableName.AccountGroup;
  static associations = {
    [TableName.Account]: { type: 'has_many', foreignKey: 'account_group_id' },
    [TableName.Vault]: { type: 'belongs_to', key: 'vault_id' },
  } as const;

  @text('nickname') nickname!: string;
  /** Whether to hide this accountGroup on the UI */
  @field('hidden') hidden!: boolean;
  @children(TableName.Account) account!: Query<Account>;
  @immutableRelation(TableName.Vault, 'vault_id') vault!: Relation<Vault>;

  @lazy hiddenAccounts = this.account.extend(Q.where('hidden', true));
  @lazy visibleAccounts = this.account.extend(Q.where('hidden', false), Q.sortBy('index', Q.asc));
  @lazy selectedAccount = this.account
    .extend(Q.where('selected', true))
    .observe()
    .pipe(map((accounts) => accounts?.[0]));

  @writer async updateName(newNickName: string) {
    await this.update((accountGroup) => {
      accountGroup.nickname = newNickName;
    });
  }
  @reader async getLastIndex() {
    const sortedAccounts = await this.account.extend(Q.sortBy('index', Q.desc)).fetch();
    return sortedAccounts?.[0]?.index ?? -1;
  }

  @reader async getAccountByIndex(index: number) {
    const accounts = await this.account.extend(Q.where('index', index)).fetch();
    return accounts?.[0];
  }

  @reader async getAccountIndex(account: Account) {
    if ((await account.accountGroup) !== this) throw new Error('Account does not belong to this accountGroup');
    return this.collections
      .get(TableName.Account)
      .query(Q.where('created_at', Q.lt(Number(account.createdAt))))
      .fetchCount();
  }
}
