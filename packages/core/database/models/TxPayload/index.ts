import { Model, type Query } from '@nozbe/watermelondb';
import { text, children } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import TableName from '../../TableName';

export class TxPayload extends Model {
  static table = TableName.TxPayload;
  static associations = {
    [TableName.Tx]: { type: 'has_many', foreignKey: 'tx_payload_id' },
  } as const;

  @text('access_list') accessList!: string; // TODO
  @text('max_fee_per_gas') maxFeePerGas!: string; // for EIP-1559
  @text('max_priority_fee_per_gas') maxPriorityFeePerGas!: string; // for EIP-1559
  @text('from') from!: string;
  @text('to') to!: string;
  @text('gas_price') gasPrice!: string;
  @text('gas') gas!: string;
  @text('storage_limit') storageLimit!: string; // for core space
  @text('data') data!: string | null;
  @text('value') value!: string;
  @text('nonce') nonce!: string;
  @text('chain_identification') chainId!: string;
  @text('epoch_height') epochHeight!: string; // for core space
  @children(TableName.Tx) txs!: Query<Tx>;
}
