import { Model, type Query } from '@nozbe/watermelondb';
import { text, children, json } from '@nozbe/watermelondb/decorators';
import { type Tx } from '../Tx';
import TableName from '../../TableName';
import { type AccessList } from 'ethers';

export class TxPayload extends Model {
  static table = TableName.TxPayload;
  static associations = {
    [TableName.Tx]: { type: 'has_many', foreignKey: 'tx_payload_id' },
  } as const;

  @text('type') type!: string | null; // tx type
  @json('access_list', (json) => json) accessList!: AccessList | null; // TODO
  @text('max_fee_per_gas') maxFeePerGas!: string | null; // for EIP-1559
  @text('max_priority_fee_per_gas') maxPriorityFeePerGas!: string | null; // for EIP-1559
  @text('from') from!: string | null;
  @text('to') to!: string | null;
  @text('gas_price') gasPrice!: string | null;
  @text('gas') gas!: string | null;
  @text('storage_limit') storageLimit!: string | null; // for core space
  @text('data') data!: string | null;
  @text('value') value!: string | null;
  @text('nonce') nonce!: string;
  @text('chain_identification') chainId!: string | null;
  @text('epoch_height') epochHeight!: string | null; // for core space
  @children(TableName.Tx) txs!: Query<Tx>;
}
