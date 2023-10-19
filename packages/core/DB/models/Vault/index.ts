import { Model, type Query } from '@nozbe/watermelondb';
import { text, field, children, reader } from '@nozbe/watermelondb/decorators';
import { type AccountGroup } from '../AccountGroup';
import TableName from '../../TableName';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import { cryptoTool } from '../../helper';

export class Vault extends Model {
  static table = TableName.Vault;
  static associations = {
    [TableName.AccountGroup]: { type: 'has_many', foreignKey: 'vault_id' },
  } as const;

  /** Type of vault: pub, pk, hd, hw */
  @text('type') type!: 'public_address' | 'private_key' | 'hierarchical_deterministic' | 'hardware';
  /** data is encrypted when the type is pk or hd. */
  @text('data') data!: string;
  /** Vault device, default is FluentWebExt */
  @text('device') device!: 'ePayWallet' | 'FluentWebExt';
  /** The accounts for conflux core and ethereum's ledger hardware wallet maybe separate. */
  @field('cfx_only') cfxOnly!: boolean | null;
  /** A Vault has only one account group. */
  @children(TableName.AccountGroup) accountGroup!: Query<AccountGroup>;

  /** get decrypted vault data. */
  @reader async getData() {
    if (this.type === 'public_address' || this.type === 'hardware') return this.data;
    return cryptoTool.decrypt<string>(this.data);
  }
}

type Params = ModelFields<Vault>;
export function createVault(params: Params, prepareCreate: true): Vault;
export function createVault(params: Params): Promise<Vault>;
export function createVault(params: Params, prepareCreate?: true) {
  return createModel<Vault>({
    name: TableName.Vault,
    params: { ...params, data: params.type === 'public_address' || params.type === 'hardware' ? params.data : cryptoTool.encrypt(params.data) },
    prepareCreate,
  });
}
