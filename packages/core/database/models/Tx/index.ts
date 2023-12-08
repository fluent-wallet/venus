import { Model, type Relation } from '@nozbe/watermelondb';
import { field, text, readonly, date, immutableRelation, json } from '@nozbe/watermelondb/decorators';
import { type Address } from '../Address';
import { type Asset } from '../Asset';
import { type App } from '../App';
import { type TxExtra } from '../TxExtra';
import { type TxPayload } from '../TxPayload';
import TableName from '../../TableName';

export enum TxStatus {
  SKIPPED = '-2',
  FAILED = '-1',
  UNSENT = '0',
  SENDING = '1',
  PENDING = '2',
  PACKAGED = '3',
  EXECUTED = '4',
  CONFIRMED = '5',
}

interface Receipt {
  blockHash?: string;
  gasUsed?: string;
  contractCreated?: string;
  // ↓↓↓↓↓↓↓↓↓↓↓ for espace ↓↓↓↓↓↓↓↓↓↓↓
  cumulativeGasUsed?: string;
  effectiveGasPrice?: string;
  type?: string;
  blockNumber?: string;
  transactionIndex?: string;
  // ↓↓↓↓↓↓↓↓↓↓↓ for core space ↓↓↓↓↓↓↓↓↓↓↓
  index?: string;
  epochNumber?: string;
  gasFee?: string;
  storageCollateralized?: string;
  gasCoveredBySponsor?: boolean;
  storageCoveredBySponsor?: boolean;
  storageReleased?: {
    address: string;
    collaterals: string;
  }[];
}

export class Tx extends Model {
  static table = TableName.Tx;
  static associations = {
    [TableName.App]: { type: 'belongs_to', key: 'app_id' },
    [TableName.Asset]: { type: 'belongs_to', key: 'asset_id' },
    [TableName.Address]: { type: 'belongs_to', key: 'address_id' },
    [TableName.TxExtra]: { type: 'belongs_to', key: 'tx_extra_id' },
    [TableName.TxPayload]: { type: 'belongs_to', key: 'tx_payload_id' },
  } as const;

  @text('raw') raw!: string; // raw tx hash
  @text('hash') hash!: string; // tx hash
  @field('status') status!: TxStatus;
  @json('receipt', (json) => json) receipt!: Receipt | null; // receipt as an object
  @field('block_number') blockNumber!: number | null;
  @text('block_hash') blockHash!: string | null;
  @field('is_chain_switched') chainSwitched!: boolean | null; // chain switched
  @readonly @date('created_at') createdAt!: Date;
  @date('pending_at') pendingAt!: number | null; // first time pending timestamp
  @text('err') err!: string | null; // basic error type/info
  @field('is_local') isLocal!: boolean | null;
  @field('resend_at') resendAt!: number | null; // epoch/block where wallet resend tx
  @immutableRelation(TableName.App, 'app_id') app!: Relation<App> | null;
  @immutableRelation(TableName.Asset, 'asset_id') asset!: Relation<Asset> | null;
  @immutableRelation(TableName.Address, 'address_id') address!: Relation<Address>;
  @immutableRelation(TableName.TxExtra, 'tx_extra_id') txExtra!: Relation<TxExtra>;
  @immutableRelation(TableName.TxPayload, 'tx_payload_id') txPayload!: Relation<TxPayload>;
}
