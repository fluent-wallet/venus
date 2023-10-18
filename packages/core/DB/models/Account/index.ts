import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { field, text, children, relation, date, readonly, writer } from '@nozbe/watermelondb/decorators';
import { type Address } from '../Address';
import { type AccountGroup } from '../AccountGroup';
import { type Network } from '../Network';
import TableName from '../../TableName';
import { getNthAccountOfHDKey } from '../../../utils/hdkey';
import { createModel } from '../../helper/modelHelper';
import { createAddress } from '../Address';
import database from '@core/DB';

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

}

export async function createAccount({
  accountGroup,
  nickname,
  hidden,
  selected,
}: {
  accountGroup: AccountGroup;
  nickname?: string;
  hidden?: boolean;
  selected?: boolean;
}) {
  if (!accountGroup) throw new Error('AccountGroup is required in createAccount.');
  const vault = await (await accountGroup).vault;

  const [networks, newAccountIndex, mnemonic] = await Promise.all([
    database.get<Network>(TableName.Network).query().fetch(),
    accountGroup.account.count,
    vault.getData(),
  ]);

  const hdRets = await Promise.all(
    networks.map(async (network) => {
      const hdPath = await network.hdPath;
      return await getNthAccountOfHDKey({
        mnemonic,
        hdPath: hdPath.value,
        nth: newAccountIndex,
      });
    })
  );

  const newAccount = createModel({
    name: TableName.Account,
    params: {
      nickname: nickname ?? `${accountGroup.nickname}-${newAccountIndex}`,
      index: newAccountIndex,
      hidden: hidden ?? false,
      selected: selected ?? false,
      accountGroup,
    },
    prepareCreate: true,
  }) as Account;

  const addresses = hdRets.map(({ address }, index) => createAddress({ network: networks[index], hex: address, account: newAccount }, true));
  await database.batch(newAccount, ...addresses);
  return newAccount;
}
