import { Network } from './../Network/index';
import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation, writer, lazy } from '@nozbe/watermelondb/decorators';
import { type Vault } from '../Vault';
import { type Account } from '../Account';
import { TableName } from '../../index';
import database from '../../index';

export class AccountGroup extends Model {
  static table = TableName.AccountGroup;
  static associations = {
    [`${TableName.Account}s`]: { type: 'has_many', foreignKey: 'account_group_id' },
    [TableName.Vault]: { type: 'belongs_to', key: 'vault_id' },
  } as const;

  @text('nickname') nickname!: string;
  @field('hidden') hidden!: boolean;
  @children(TableName.Account) accounts!: Query<Account>;
  @immutableRelation(TableName.Vault, 'vault_id') vault!: Relation<Vault>;

  @lazy hiddenAccounts = this.accounts.extend(Q.where('hidden', true));

  @writer async updateName(newNickName: string) {
    await this.update((accountGroup) => { 
      accountGroup.nickname = newNickName;
    });
  }

  @writer async addAccount({ nickname, hidden, selected }: { nickname?: string; hidden?: boolean; selected?: boolean } = { hidden: false, selected: false }) {
    const networks = await this.collections.get<Network>(TableName.Network).query().fetch();
    const mnemonic = await (await this.vault).getMnemonic();

    const newAccountIndex = await this.accounts.count;
    const newAccount = await this.collections.get(`${TableName.Account}s`).create(async (_newAccount) => {
      const newAccount = _newAccount as Account;
      newAccount.accountGroup.set(this);
      newAccount.index = newAccountIndex;
      newAccount.nickname = nickname ?? `${this.nickname}-${newAccountIndex}`;
      newAccount.hidden = hidden ?? false;
      newAccount.selected = selected ?? false;
    });
    return newAccount;
  }

  static findById = (id: string) => database.collections.get(TableName.AccountGroup).find(id);
}
