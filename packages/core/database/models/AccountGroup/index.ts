import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation, writer, reader, lazy } from '@nozbe/watermelondb/decorators';
import { map, firstValueFrom } from 'rxjs';
import { type Vault } from '../Vault';
import { type Account } from '../Account';
import TableName from '../../TableName';

export class AccountGroup extends Model {
  static table = TableName.AccountGroup;
  static associations = {
    [TableName.Vault]: { type: 'belongs_to', key: 'vault_id' },
    [TableName.Account]: { type: 'has_many', foreignKey: 'account_group_id' },
  } as const;

  @text('nickname') nickname!: string;
  /** Whether to hide this accountGroup on the UI */
  @field('hidden') hidden!: boolean;
  @children(TableName.Account) accounts!: Query<Account>;
  @immutableRelation(TableName.Vault, 'vault_id') vault!: Relation<Vault>;

  @lazy hiddenAccounts = this.accounts.extend(Q.where('hidden', true));
  @lazy visibleAccounts = this.accounts.extend(Q.where('hidden', false), Q.sortBy('index', Q.asc));
  @lazy observeSelectedAccount = this.accounts
    .extend(Q.where('selected', true))
    .observe()
    .pipe(map((accounts) => accounts?.[0]));

  @writer async updateName(newNickName: string) {
    await this.update((accountGroup) => {
      accountGroup.nickname = newNickName;
    });
  }

  @writer async changeHidden(hidden: boolean) {
    if (this.hidden === hidden) return;
    await this.update((account) => {
      account.hidden = hidden;
    });
  }

  prepareChangeHidden(hidden: boolean) {
    return this.prepareUpdate((account) => {
      account.hidden = hidden;
    });
  }

  @reader async getLastAccountIndex() {
    return firstValueFrom(
      this.accounts
        .extend(Q.sortBy('index', Q.desc))
        .observe()
        .pipe(map((accounts) => accounts?.at?.(0)?.index ?? -1))
    );
  }

  @reader async getAccountByIndex(index: number) {
    const accounts = await this.accounts.extend(Q.where('index', index)).fetch();
    return accounts?.at?.(0);
  }
}
