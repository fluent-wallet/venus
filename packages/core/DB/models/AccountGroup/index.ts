import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation, writer, reader, lazy } from '@nozbe/watermelondb/decorators';
import { type Vault } from '../Vault';
import { type Account } from '../Account';
import TableName from '../../TableName';
import { createAccount } from '../Account/service';

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

  @writer async updateName(newNickName: string) {
    await this.update((accountGroup) => {
      accountGroup.nickname = newNickName;
    });
  }

  async addAccount(params: { nickname?: string; hidden?: boolean; selected?: boolean } = { hidden: false, selected: false }) {
    if ((await this.vault).type !== 'hierarchical_deterministic') {
      throw new Error('Only HD type vault can add account.');
    }
    return await createAccount({ ...params, accountGroup: this });
  }

  @reader async getLastIndex() {
    const account = (await this.collections.get(TableName.Account).query(Q.sortBy('index', Q.desc)).fetch()) as Array<Account>;
    return account[0].index ?? 0;
  }

  @reader async getAccountByIndex(index: number) {
    const accounts = (await this.collections.get(TableName.Account).query(Q.where('index', index)).fetch()) as Array<Account>;
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
