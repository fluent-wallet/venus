import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation, writer, reader, lazy } from '@nozbe/watermelondb/decorators';
import { type Vault } from '../Vault';
import { type Account } from '../Account';
import TableName from '../../TableName';
import { createAccount } from '@core/DB/service/Account';
import { ModelFields, createModel } from '@core/DB/helper/modelHelper';

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

  @writer async addAccount(params: { nickname?: string; hidden?: boolean; selected?: boolean } = { hidden: false, selected: false }) {
    return await this.callWriter(() => createAccount({ ...params, accountGroup: this }));
  }

  @reader async getAccountIndex(account: Account) {
    if ((await account.accountGroup) !== this) throw new Error('Account does not belong to this accountGroup');
    return this.collections
      .get(TableName.Account)
      .query(Q.where('created_at', Q.lt(Number(account.createdAt))))
      .fetchCount();
  }
}
type Params = ModelFields<AccountGroup>;
export async function createAccountGroup(params: Params, prepareCreate?: true) {
  return createModel<AccountGroup>({
    name: TableName.AccountGroup,
    params: {
      ...params,
    },
    prepareCreate,
  });
}
