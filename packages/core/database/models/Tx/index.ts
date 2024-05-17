import { of } from 'rxjs';
import { Model, type Relation } from '@nozbe/watermelondb';
import { field, text, readonly, date, immutableRelation, json, writer, reader } from '@nozbe/watermelondb/decorators';
import { type Address } from '../Address';
import { type Asset } from '../Asset';
import { type App } from '../App';
import { type TxExtra } from '../TxExtra';
import { type TxPayload } from '../TxPayload';
import TableName from '../../TableName';
import { ExecutedStatus, Receipt, TxSource, TxStatus } from './type';
import { ProcessErrorType } from '@core/utils/eth';

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
  @text('hash') hash?: string | null;
  @text('status') status!: TxStatus;
  @text('executed_status') executedStatus?: ExecutedStatus | null;
  /** receipt as an object */
  @json('receipt', (json) => json) receipt?: Receipt | null;
  @readonly @date('created_at') createdAt!: Date;
  /** tx execute timestamp */
  @date('executed_at') executedAt?: Date | null;
  /** basic error type */
  @text('error_type') errorType?: ProcessErrorType | null;
  /** basic error info */
  @text('err') err?: string | null;
  @date('send_at') sendAt!: Date;
  @date('resend_at') resendAt?: Date | null;
  @field('resend_count') resendCount?: number | null;
  @field('polling_count') pollingCount?: number | null;
  @field('confirmed_number') confirmedNumber?: number | null;
  @field('is_temp_replaced') isTempReplaced?: boolean | null;
  @text('source') source!: TxSource;
  @text('method') method!: string;
  /** optional, Relation<App | null> */
  @immutableRelation(TableName.App, 'app_id') app!: Relation<App>;
  /** optional, Relation<Asset | null> */
  @immutableRelation(TableName.Asset, 'asset_id') asset!: Relation<Asset>;
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
