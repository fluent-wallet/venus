import { Model, type Query } from '@nozbe/watermelondb';
import { text, field, children, writer, lazy, reader } from '@nozbe/watermelondb/decorators';
import { map, firstValueFrom } from 'rxjs';
import { type AccountGroup } from '../AccountGroup';
import TableName from '../../TableName';
import VaultType from './VaultType';

export class Vault extends Model {
  static table = TableName.Vault;
  static associations = {
    [TableName.AccountGroup]: { type: 'has_many', foreignKey: 'vault_id' },
  } as const;

  /** Type of vault: pub, pk, hd, hw */
  @text('type') type!: VaultType;
  /** data need to be encrypted when the type is pk or hd. */
  @text('data') data!: string | null;
  /** Vault device, default is ePayWallet */
  @text('device') device!: 'ePayWallet' | 'FluentWebExt';
  /** The accounts for conflux core and ethereum's ledger hardware wallet maybe separate. */
  @field('cfx_only') cfxOnly!: boolean | null;
  /**
   * A Vault has only one account group.
   * */
  @children(TableName.AccountGroup) accountGroups!: Query<AccountGroup>;
  @lazy observeAccountGroup = this.accountGroups.observe().pipe(map((accountGroups) => accountGroups.at(0)));

  get isGroup() {
    return this.type === VaultType.HierarchicalDeterministic || this.type === VaultType.BSIM;
  }

  @reader async getAccountGroup() {
    return (await firstValueFrom(this.observeAccountGroup))!;
  }

  @writer async delete() {
    const accountGroup = await this.getAccountGroup();
    const accounts = await accountGroup.accounts;
    const addresses = (await Promise.all(accounts.map(async (account) => await account.addresses))).flat();
    this.batch(
      ...addresses.map((address) => address.prepareDestroyPermanently()),
      ...accounts.map((account) => account.prepareDestroyPermanently()),
      accountGroup.prepareDestroyPermanently(),
      this.prepareDestroyPermanently()
    );
  }
}
