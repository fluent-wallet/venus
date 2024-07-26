import type { ProcessErrorType } from '@core/utils/eth';
import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, date, field, immutableRelation, json, reader, readonly, relation, text, writer } from '@nozbe/watermelondb/decorators';
import { of } from 'rxjs';
import TableName from '../../TableName';
import type { Address } from '../Address';
import type { App } from '../App';
import type { Asset } from '../Asset';
import type { Signature } from '../Signature';
import type { TxExtra } from '../TxExtra';
import type { TxPayload } from '../TxPayload';
import { FINALIZED_TX_STATUSES, type TxStatus, type ExecutedStatus, type Receipt, type TxSource } from './type';

export class Tx extends Model {
  static table = TableName.Tx;
  static associations = {
    [TableName.App]: { type: 'belongs_to', key: 'app_id' },
    [TableName.Asset]: { type: 'belongs_to', key: 'asset_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.TxExtra]: { type: 'belongs_to', key: 'tx_extra_id' },
    [TableName.TxPayload]: { type: 'belongs_to', key: 'tx_payload_id' },
    [TableName.Signature]: { type: 'has_many', foreignKey: 'tx_id' },
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
  /** @deprecated */
  @field('polling_count') pollingCount?: number | null;
  /** @deprecated */
  @field('confirmed_number') confirmedNumber?: number | null;
  /** replaced by inner tx */
  @field('is_temp_replaced') isReplacedByInner?: boolean | null;
  @text('source') source!: TxSource;
  @text('method') method!: string;
  /** optional, Relation<App | null> */
  @relation(TableName.App, 'app_id') app!: Relation<App>;
  /** optional, Relation<Asset | null> */
  @immutableRelation(TableName.Asset, 'asset_id') asset!: Relation<Asset>;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
  @immutableRelation(TableName.TxExtra, 'tx_extra_id') txExtra!: Relation<TxExtra>;
  @immutableRelation(TableName.TxPayload, 'tx_payload_id') txPayload!: Relation<TxPayload>;
  /** optional, Query<Signature> | null */
  @children(TableName.Signature) signatures!: Query<Signature>;

  @writer updateSelf(recordUpdater: (_: this) => void) {
    if (FINALIZED_TX_STATUSES.includes(this.status)) return Promise.resolve(this);
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
