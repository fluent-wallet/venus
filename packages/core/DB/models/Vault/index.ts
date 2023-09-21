import { Model, type Query } from '@nozbe/watermelondb';
import { text, field, children, reader } from '@nozbe/watermelondb/decorators';
import { type AccountGroup } from '../AccountGroup';
import { TableName } from '../../index';
import { cryptoTool } from '../../utils';

export class Vault extends Model {
  static table = TableName.Vault;
  static associations = {
    [TableName.AccountGroup]: { type: 'has_many', foreignKey: 'vault_id' },
  } as const;

  @text('type') type!: string;
  @text('data') data!: string;
  @text('device') device!: string;
  @field('cfx_only') cfxOnly!: boolean | null;
  @children(TableName.AccountGroup) accountGroup!: Query<AccountGroup>;

  @reader async getMnemonic() {
    const { data: mnemonic } = await cryptoTool.decrypt<string>(this.data);
    return mnemonic;
  }
}
