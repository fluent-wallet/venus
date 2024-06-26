import { Model, type Relation } from '@nozbe/watermelondb';
import { date, immutableRelation, readonly, text } from '@nozbe/watermelondb/decorators';
import TableName from '../../TableName';
import type { Account } from '../Account';
import type { App } from '../App';
import type { Network } from '../Network';

export enum Permissions {
  Disable = 'disable',
  /** basic rpc methods like cfx_epochNumber, eth_blockNumber. */
  WalletBasic = 'basic',
  DisableBasic = 'disable_basic',
  /**
   * methods
   * to get user addresses like eth_accounts, cfx_accounts
   * to request user's signature of these accounts, eg. cfx_sendTransaction, eth_signTypedData_v4
   */
  Accounts = 'accounts',
  DisableAccounts = 'disable_accounts',
  /**
   * Permission to access to the other networks in this network.
   * rule is a chainId array, eg. ['1029', '71'] means the app can operate this two networks and current network permission belongs to.
   */
  CrossNetwork = 'cross_network',
  DisableCrossNetwork = 'disable_cross_network',
}

export class Permission extends Model {
  static table = TableName.Permission;
  static associations = {
    [TableName.App]: { type: 'belongs_to', key: 'app_id' },
    [TableName.Network]: { type: 'belongs_to', key: 'network_id' },
    [TableName.Account]: { type: 'belongs_to', key: 'account_id' },
  } as const;

  @text('type') type!: Permissions;
  @text('rule') rule?: string;
  @readonly @date('created_at') createdAt!: Date;
  @immutableRelation(TableName.App, 'app_id') app!: Relation<App>;
  @immutableRelation(TableName.Network, 'network_id') network!: Relation<Network>;
  @immutableRelation(TableName.Account, 'account_id') account!: Relation<Account>;
}
