import { of } from 'rxjs';
import { Model, type Relation } from '@nozbe/watermelondb';
import { field, text, readonly, date, immutableRelation, json, writer, reader } from '@nozbe/watermelondb/decorators';
import { type Address } from '../Address';
import { type Asset } from '../Asset';
import { type App } from '../App';
import { type TxExtra } from '../TxExtra';
import { type TxPayload } from '../TxPayload';
import TableName from '../../TableName';
import { Receipt, TxStatus } from './type';

export class Tx extends Model {
  static table = TableName.Tx;
  static associations = {
    [TableName.App]: { type: 'belongs_to', key: 'app_id' },
    [TableName.Asset]: { type: 'belongs_to', key: 'asset_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.TxExtra]: { type: 'belongs_to', key: 'tx_extra_id' },
    [TableName.TxPayload]: { type: 'belongs_to', key: 'tx_payload_id' },
  } as const;

  /** raw tx hash */
  @text('raw') raw!: string | null;
  /** tx hash */
  @text('hash') hash!: string;
  @field('status') status!: TxStatus;
  /** receipt as an object */
  @json('receipt', (json) => json) receipt?: Receipt | null;
  @field('block_number') blockNumber?: string | null;
  @text('block_hash') blockHash?: string | null;
  /** chain switched */
  @field('is_chain_switched') chainSwitched?: boolean | null;
  /** for skipped check */
  @field('skipped_checked') skippedChecked?: boolean | null;
  @readonly @date('created_at') createdAt!: Date;
  /** first time pending timestamp */
  @date('pending_at') pendingAt?: Date | null;
  /** tx execute timestamp */
  @date('executed_at') executedAt?: Date | null;
  /** basic error type/info */
  @text('err') err?: string | null;
  @field('is_local') isLocal?: boolean | null;
  /** epoch/block where wallet resend tx */
  @field('resend_at') resendAt?: string | null;
  /** optional, Relation<App | null> */
  @immutableRelation(TableName.App, 'app_id') app!: Relation<App>;
  /** optional, Relation<Asset | null> */
  @immutableRelation(TableName.Asset, 'asset_id') private asset!: Relation<Asset>;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
  @immutableRelation(TableName.TxExtra, 'tx_extra_id') txExtra!: Relation<TxExtra>;
  @immutableRelation(TableName.TxPayload, 'tx_payload_id') txPayload!: Relation<TxPayload>;

  @writer updateSelf(recordUpdater: (_: this) => void) {
    return this.update(recordUpdater);
  }

  @reader async getAsset() {
    if (!this.asset.id) return null;
    const asset = await this.asset;
    return asset;
  }
  observeAsset() {
    if (!this.asset.id) return of(null);
    return this.asset.observe();
  }

  @reader async getApp() {
    if (!this.app.id) return null;
    const app = await this.app;
    return app;
  }
  observeApp() {
    if (!this.app.id) return of(null);
    return this.app.observe();
  }
}
