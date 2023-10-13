import { Model, Q, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, immutableRelation, writer, lazy } from '@nozbe/watermelondb/decorators';
import { type Vault } from '../Vault';
import { type Account } from '../Account';
import { type Network } from '../Network';
import TableName from '../../TableName';
import { getNthAccountOfHDKey } from '../../../utils/hdkey';
import { cryptoTool } from '../../helper';
import database from '@core/DB';

export class AccountGroup extends Model {
  static table = TableName.AccountGroup;
  static associations = {
    [TableName.Account]: { type: 'has_many', foreignKey: 'account_group_id' },
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
    const [networks, newAccountIndex, mnemonic] = await Promise.all([
      this.collections.get<Network>(TableName.Network).query().fetch(),
      this.accounts.count,
      (await this.vault).getMnemonic(),
    ]);

    const hdRets = await Promise.all(
      networks.map(async ({ hdPath }) => {
        const hdPathRecord = await hdPath.fetch();
        const ret = (await getNthAccountOfHDKey({
          mnemonic,
          hdPath: hdPathRecord.value,
          nth: newAccountIndex,
        })) as Awaited<ReturnType<typeof getNthAccountOfHDKey>> & { encryptedPk: string };
        ret.encryptedPk = await cryptoTool.encrypt(ret.privateKey);
        return ret;
      })
    );

    const newAccount = this.collections.get(TableName.Account).prepareCreate((_newAccount) => {
      const newAccount = _newAccount as Account;
      newAccount.accountGroup.set(this);
      newAccount.index = newAccountIndex;
      newAccount.nickname = nickname ?? `${this.nickname}-${newAccountIndex}`;
      newAccount.hidden = hidden ?? false;
      newAccount.selected = selected ?? false;
      _newAccount = newAccount;
    }) as Account;
    const addresses = hdRets.map(({ address, encryptedPk }, index) =>
      newAccount.createAddress({ prepareCreate: true, network: networks[index], hex: address, pk: encryptedPk })
    );
    await this.batch(newAccount, ...addresses);
    return newAccount;
  }
}

export const findAccountGroupById = (id: string) => database.collections.get(TableName.AccountGroup).find(id);
