import { Model, type Query } from '@nozbe/watermelondb';
import { text, children } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import TableName from '../../TableName';

export class TxPayload extends Model {
  static table = TableName.TxPayload;

  @text('access_list') accessList!: string;
  @text('max_fee_per_gas') maxFeePerGas!: string;
  @text('max_priority_fee_per_gas') maxPriorityFeePerGas!: string;
  @text('from') from!: string;
  @text('to') to!: string;
  @text('gas_price') gasPrice!: string;
  @text('gas') gas!: string;
  @text('storage_limit') storageLimit!: string;
  @text('data') data!: string | null;
  @text('value') value!: string;
  @text('nonce') nonce!: string;
  @text('chain_identification') chainId!: string;
  @text('epoch_height') epochHeight!: string;
  @children(TableName.Tx) txs!: Query<Tx>;
}
