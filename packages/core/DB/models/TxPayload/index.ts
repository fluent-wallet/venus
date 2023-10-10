import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';
import { TableName } from '../../index';

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
}
